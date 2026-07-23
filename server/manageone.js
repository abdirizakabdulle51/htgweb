import crypto from "crypto";
import { parseManageOnePhone } from "../src/lib/phone.js";

const DEFAULT_AUTH_BASE_URL = "https://10.20.24.9:26335";
const DEFAULT_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const DEFAULT_SERVICE_BASE_URL = "https://service.htgclouds.com/moserviceaccesswebsite/goku/rest/vdc";
const DEFAULT_AUTH_DOMAIN = "mo_bss_admin";
const DEFAULT_TOKEN_TTL_MS = 20 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const MAX_RESPONSE_DETAIL_LENGTH = 1200;
const DEFAULT_VDC_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_EXTERNAL_NETWORKS = [
  {
    id: "e5f48527-06ab-4f2a-be05-6f21e968c945",
    name: "dummy_external_network"
  },
  {
    id: "b79700e5-6929-4a46-ae16-93a29999b3d2",
    name: "eip_external"
  }
];
const REGION_PROFILES = {
  hoa: {
    envPrefix: "MANAGEONE_HOA",
    regionId: "hoa-mogadishu-2",
    cloudInfraId: "FUSION_CLOUD_hoa-mogadishu-2",
    azKvm: "az1.cls",
    azBms: "az2.cls",
    externalNetworks: DEFAULT_EXTERNAL_NETWORKS
  },
  hq3: {
    envPrefix: "MANAGEONE_HQ3",
    regionId: "htgcloud-region-02",
    cloudInfraId: "FUSION_CLOUD_htgcloud-region-02",
    azKvm: "az1.hq3",
    azBms: "az2.hq3",
    externalNetworks: [
      {
        id: "b24abfa6-5e67-4aea-ac3e-4897b7c1bd59",
        name: "dummy_external_network"
      },
      {
        id: "f7626aa4-cfcf-4994-8295-f60516945c26",
        name: "eip_external"
      }
    ]
  }
};

let cachedSession = null;
let cachedExternalNetworkSession = null;

class ManageOneError extends Error {
  constructor(step, message, detail) {
    super(`ManageOne ${step} failed: ${message}${detail ? ` (${detail})` : ""}`);
    this.name = "ManageOneError";
    this.step = step;
    this.detail = detail;
  }
}

function config() {
  const regions = configuredRegions();
  const primaryRegion = regions[0];

  return {
    enabled: process.env.MANAGEONE_ENABLED === "true",
    username: process.env.MANAGEONE_USERNAME || "",
    password: process.env.MANAGEONE_PASSWORD || "",
    authBaseUrl: stripTrailingSlash(process.env.MANAGEONE_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL),
    authDomain: process.env.MANAGEONE_AUTH_DOMAIN || DEFAULT_AUTH_DOMAIN,
    externalNetworkUsername: process.env.MANAGEONE_EXTERNAL_NETWORK_USERNAME || "",
    externalNetworkPassword: process.env.MANAGEONE_EXTERNAL_NETWORK_PASSWORD || "",
    externalNetworkAuthDomain:
      process.env.MANAGEONE_EXTERNAL_NETWORK_AUTH_DOMAIN ||
      process.env.MANAGEONE_AUTH_DOMAIN ||
      DEFAULT_AUTH_DOMAIN,
    baseUrl: stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_BASE_URL),
    serviceBaseUrl: stripTrailingSlash(process.env.MANAGEONE_SERVICE_BASE_URL || DEFAULT_SERVICE_BASE_URL),
    regionProfile: process.env.MANAGEONE_REGION_PROFILE || "hoa",
    regions,
    regionId: primaryRegion.regionId,
    cloudInfraId: primaryRegion.cloudInfraId,
    azKvm: primaryRegion.azKvm,
    azBms: primaryRegion.azBms,
    vdcAdminRoleId: process.env.MANAGEONE_VDC_ADMIN_ROLE_ID || DEFAULT_VDC_ADMIN_ROLE_ID,
    allocateExternalNetworks: process.env.MANAGEONE_ALLOCATE_EXTERNAL_NETWORKS === "true",
    bindUserContact: process.env.MANAGEONE_BIND_USER_CONTACT !== "false",
    enableUserMfa: process.env.MANAGEONE_ENABLE_USER_MFA === "true",
    externalNetworks: primaryRegion.externalNetworks,
    upperVdcId: process.env.MANAGEONE_UPPER_VDC_ID || "0",
    timeoutMs: Number(process.env.MANAGEONE_TIMEOUT_MS || 30000),
    tokenTtlMs: Number(process.env.MANAGEONE_TOKEN_TTL_MS || DEFAULT_TOKEN_TTL_MS),
    rejectUnauthorized: process.env.MANAGEONE_TLS_REJECT_UNAUTHORIZED !== "false"
  };
}

export async function provisionTenant({ companyName, fullName, email, phoneNumber, username, plaintextPassword }) {
  const cfg = config();
  const tenantName = normalizeTenantName(companyName || username || email);
  const tenantUsername = normalizeUsername(username || email);
  console.log(
    `[MANAGEONE] Provisioning ${tenantName} in ${cfg.regionProfile} (${cfg.regions
      .map((region) => region.regionId)
      .join(", ")})`
  );

  await assertTenantUsernameAvailable(tenantUsername);

  const vdc = await createTenantVdc({
    name: tenantName,
    description: "",
    managerName: fullName,
    managerEmail: email,
    managerPhone: phoneNumber
  });

  let group;
  let user;

  try {
    await bindRegion(vdc.vdcId);
    group = await findVdcAdminGroup(vdc.vdcId);
    user = await createTenantUser(vdc.vdcId, {
      username: tenantUsername,
      email,
      phoneNumber,
      plaintextPassword
    });
  } catch (error) {
    if (isDuplicateUsernameError(error)) {
      await cleanupCreatedTenantVdc(vdc.vdcId, tenantName, error);
    }
    throw error;
  }

  await updateTenantUserContactAndMfa(user.userId, { email, phoneNumber });
  await bindUserToGroup(user.userId, group.groupId, vdc.vdcId);
  await waitForVdcAdminMembership(user.userId, group.groupId, vdc.vdcId);

  const tenantSession = await authenticateTenantUser({
    username: tenantUsername,
    password: plaintextPassword,
    domainName: vdc.domainName || tenantName
  });
  const externalNetworksAllocated = await tryAllocateExternalNetworks(vdc.vdcId, tenantName);
  const resourceSpaces = await createResourceSpaces(vdc.vdcId, tenantName, tenantSession);
  const primaryResourceSpace = resourceSpaces[0] || null;

  return {
    vdcId: vdc.vdcId,
    domainId: vdc.domainId,
    resourceSpaceId: primaryResourceSpace?.resourceSpaceId || null,
    resourceSpaceIds: resourceSpaces.map((resourceSpace) => resourceSpace.resourceSpaceId),
    externalNetworksAllocated,
    groupId: group.groupId,
    userId: user.userId
  };
}

export async function authenticate({ force = false } = {}) {
  const cfg = config();
  assertConfigured(cfg);
  configureTls(cfg);

  if (!force && cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession;
  }

  const response = await request("auth token", `${cfg.authBaseUrl}/v3/auth/tokens`, {
    cfg,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: {
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              name: cfg.username,
              password: cfg.password,
              domain: {
                name: cfg.authDomain
              }
            }
          }
        },
        scope: {
          domain: {
            name: cfg.authDomain
          }
        }
      }
    },
    expectedStatuses: [201]
  });

  const token = response.headers.get("x-subject-token");
  if (!token) {
    throw new ManageOneError("auth token", "Response did not include X-Subject-Token");
  }

  cachedSession = {
    token,
    expiresAt: tokenExpiresAt(response.body, cfg)
  };

  return cachedSession;
}

export async function authenticateExternalNetworkAllocator({ force = false } = {}) {
  const cfg = config();
  assertExternalNetworkConfigured(cfg);
  configureTls(cfg);

  if (!force && cachedExternalNetworkSession && Date.now() < cachedExternalNetworkSession.expiresAt) {
    return cachedExternalNetworkSession;
  }

  const response = await request("external network auth token", `${cfg.authBaseUrl}/v3/auth/tokens`, {
    cfg,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: {
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              name: cfg.externalNetworkUsername,
              password: cfg.externalNetworkPassword,
              domain: {
                name: cfg.externalNetworkAuthDomain
              }
            }
          }
        },
        scope: {
          domain: {
            name: cfg.externalNetworkAuthDomain
          }
        }
      }
    },
    expectedStatuses: [201]
  });

  const token = response.headers.get("x-subject-token");
  if (!token) {
    throw new ManageOneError("external network auth token", "Response did not include X-Subject-Token");
  }

  cachedExternalNetworkSession = {
    token,
    username: cfg.externalNetworkUsername,
    expiresAt: tokenExpiresAt(response.body, cfg)
  };

  console.log(`[MANAGEONE] External network allocation token issued for ${cfg.externalNetworkUsername}`);

  return cachedExternalNetworkSession;
}

export async function authenticateTenantUser({ username, password, domainName }) {
  const cfg = config();
  assertConfigured(cfg);
  configureTls(cfg);

  let lastError = null;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await request("tenant auth token", `${cfg.authBaseUrl}/v3/auth/tokens`, {
        cfg,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          auth: {
            identity: {
              methods: ["password"],
              password: {
                user: {
                  name: username,
                  password,
                  domain: {
                    name: domainName
                  }
                }
              }
            },
            scope: {
              domain: {
                name: domainName
              }
            }
          }
        },
        expectedStatuses: [201]
      });

      const token = response.headers.get("x-subject-token");
      if (!token) {
        throw new ManageOneError("tenant auth token", "Response did not include X-Subject-Token");
      }

      return {
        token,
        expiresAt: tokenExpiresAt(response.body, cfg)
      };
    } catch (error) {
      lastError = error;
      if (attempt < 8 && error instanceof ManageOneError && /HTTP 401|HTTP 403|unauthorized|auth/i.test(error.message)) {
        await sleep(1500);
        continue;
      }
      break;
    }
  }

  throw lastError || new ManageOneError("tenant auth token", "Authentication did not complete");
}

export async function createTenantVdc({ name, description = "", managerName, managerEmail, managerPhone }) {
  const cfg = config();
  const response = await apiRequest("create tenant/VDC", `${cfg.baseUrl}/v3.1/vdcs`, {
    method: "POST",
    body: {
      vdc: {
        is_domain: true,
        upper_vdc_id: cfg.upperVdcId,
        domain_name: name,
        domain_description: description,
        name,
        admin_group: true,
        extra: JSON.stringify({
          manager: managerName || "",
          phone: managerPhone || "",
          email: managerEmail || ""
        }),
        mfa_status: false,
        tag: "vdc"
      }
    },
    expectedStatuses: [200, 201]
  });

  const vdc = response?.vdc || {};
  if (!vdc.id || !vdc.domain_id) {
    throw new ManageOneError("create tenant/VDC", "Response did not include vdc.id and vdc.domain_id");
  }

  return {
    vdcId: vdc.id,
    domainId: vdc.domain_id,
    domainName: vdc.domain_name || name
  };
}

export async function createResourceSpaces(vdcId, tenantName, session) {
  const cfg = config();
  const resourceSpaces = [];

  for (const region of cfg.regions) {
    resourceSpaces.push(await createResourceSpace(vdcId, tenantName, session, region));
  }

  return resourceSpaces;
}

export async function createResourceSpace(vdcId, tenantName, session, region = config().regions[0]) {
  const cfg = config();
  const resourceSpaceName = defaultResourceSpaceName(tenantName, region.regionId);
  const payload = {
    project: {
      tenant_id: vdcId,
      name: resourceSpaceName,
      display_name: "",
      description: "",
      is_bind_external_network: true,
      is_shared: "false",
      is_support_hws_service: true,
      quotas: [],
      regions: [
        {
          region_id: region.regionId
        }
      ]
    }
  };
  const candidateUrls = [`${cfg.baseUrl}/v3.1/projects`];
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const url of candidateUrls) {
      try {
        const response = await apiRequest("create resource space", url, {
          session,
          method: "POST",
          body: payload,
          expectedStatuses: [200, 201]
        });
        const project = response?.project || {};
        if (project.id) {
          return {
            resourceSpaceId: project.id,
            resourceSpaceName
          };
        }

        throw new ManageOneError("create resource space", "Response did not include project.id", safeDetail(response));
      } catch (error) {
        lastError = error;
        const detail = error instanceof Error ? error.message : String(error || "Unknown error");
        console.warn(`[MANAGEONE] create resource space candidate failed: ${url} => ${safeDetail(detail)}`);

        if (
          !(error instanceof ManageOneError) ||
          !/HTTP 403|HTTP 404|Route Not Found|Unexpected HTTP 200.*authui\/login|project\.id/i.test(error.message)
        ) {
          throw error;
        }
      }
    }

    if (attempt < 3) {
      await sleep(1000);
    }
  }

  throw lastError || new ManageOneError("create resource space", "No candidate endpoint succeeded");
}

export async function bindRegion(vdcId) {
  const cfg = config();
  await apiRequest("bind region", `${cfg.baseUrl}/v3.1/vdcs/${encodeURIComponent(vdcId)}/regions`, {
    method: "PUT",
    body: {
      regions: cfg.regions.map((region) => ({
          region_id: region.regionId,
          action: "bind",
          cloud_infras: [
            {
              cloud_infra_id: region.cloudInfraId,
              action: "bind",
              available_zones: [
                { az_id: region.azKvm, action: "bind" },
                { az_id: region.azBms, action: "bind" }
              ]
            }
          ]
        }))
    },
    expectedStatuses: [204]
  });
}

export async function allocateExternalNetworks(vdcId) {
  const cfg = config();
  const session = await authenticateExternalNetworkAllocator();

  for (const region of cfg.regions) {
    for (const network of region.externalNetworks) {
      console.log(
        `[MANAGEONE] Allocating external network ${network.name} for VDC ${vdcId} in ${region.regionId} as ${session.username}`
      );
      await apiRequest(`allocate external network ${network.name}`, `${cfg.baseUrl}/v3.0/vdcs/external-networks/${encodeURIComponent(network.id)}`, {
        session,
        method: "PUT",
        body: {
          resource_id: vdcId,
          associateAction: true,
          cloudInfraId: region.cloudInfraId,
          inherit: true,
          networkName: network.name
        },
        expectedStatuses: [204]
      });
    }
  }

  console.log(`[MANAGEONE] External network allocation completed for VDC ${vdcId}`);
}

async function tryAllocateExternalNetworks(vdcId, tenantName) {
  if (!config().allocateExternalNetworks) {
    return false;
  }

  try {
    await allocateExternalNetworks(vdcId);
    return true;
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error;
    }

    console.warn(
      `[MANAGEONE] External network allocation skipped for ${tenantName}: ${safeDetail(error.message)}`
    );
    return false;
  }
}

export async function findVdcAdminGroup(vdcId) {
  const cfg = config();
  const rootUrl = cfg.baseUrl.replace(/\/vdc$/, "");
  const encodedVdcId = encodeURIComponent(vdcId);
  const candidateUrls = [
    `${cfg.baseUrl}/v3.2/vdcs/${encodedVdcId}/groups?start=0&limit=100&sort_key=name&sort_dir=asc`,
    `${cfg.baseUrl}/v3.2/vdcs/${encodedVdcId}/groups?start=0&limit=100`,
    `${rootUrl}/vdc-server/v3/vdcs/${encodedVdcId}/groups?start=0&limit=100&sort_key=name&sort_dir=asc`
  ];

  let lastResponse = null;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await firstSuccessfulApiRequest("find VDC Admin group", candidateUrls, {
      expectedStatuses: [200]
    });

    lastResponse = response;

    const groups = extractGroups(response);
    const adminGroup = groups.find((group) => {
      const displayName = String(group.display_name || group.displayName || "").toLowerCase();
      const name = String(group.name || "").toLowerCase();
      const description = String(group.description || "").toLowerCase();
      return (
        group.type === "default" &&
        (displayName === "vdc admin" ||
          name.startsWith("admin_") ||
          description.includes("default vdc administrator group"))
      );
    });

    if (adminGroup?.id) {
      return { groupId: adminGroup.id };
    }

    if (attempt < 8) {
      await sleep(1500);
    }
  }

  throw new ManageOneError(
    "find VDC Admin group",
    "Response did not include the default VDC Admin group",
    safeDetail(lastResponse)
  );
}

export async function waitForVdcAdminMembership(userId, groupId, vdcId) {
  const cfg = config();
  const rootUrl = cfg.baseUrl.replace(/\/vdc$/, "");
  const encodedGroupId = encodeURIComponent(groupId);
  const candidateUrls = [
    `${cfg.baseUrl}/v3.2/groups/${encodedGroupId}/users?start=0&limit=100`,
    `${rootUrl}/vdc-server/v3/groups/${encodedGroupId}/users?start=0&limit=100`
  ];

  let lastResponse = null;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await firstSuccessfulApiRequest("verify VDC Admin membership", candidateUrls, {
      expectedStatuses: [200]
    });

    lastResponse = response;
    const users = extractUsers(response);
    const hasUser = users.some((user) => String(user.id || user.user_id || user.userId || "") === String(userId));

    if (hasUser || responseContainsValue(response, userId)) {
      console.log(`[MANAGEONE] VDC Admin membership verified for user ${userId}`);
      return;
    }

    if (attempt < 8) {
      await sleep(1000);
    }
  }

  throw new ManageOneError(
    "verify VDC Admin membership",
    `User ${userId} was not visible in VDC Admin group ${groupId}`,
    safeDetail(lastResponse)
  );
}

function extractGroups(response) {
  if (Array.isArray(response?.groups)) return response.groups;
  if (Array.isArray(response?.data?.groups)) return response.data.groups;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.body?.groups)) return response.body.groups;
  return [];
}

function extractUsers(response) {
  if (Array.isArray(response?.users)) return response.users;
  if (Array.isArray(response?.data?.users)) return response.data.users;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.body?.users)) return response.body.users;
  return [];
}

function responseContainsValue(response, value) {
  return JSON.stringify(response || {}).includes(String(value));
}

export async function getUserPasswordPublicKey() {
  const cfg = config();
  const rootUrl = cfg.baseUrl.replace(/\/vdc$/, "");
  const candidateUrls = [
    `${cfg.baseUrl}/v3.0/system/pub-key`,
    `${rootUrl}/vdc/v3.0/system/pub-key`,
    `${rootUrl}/vdc-server/v3.0/system/pub-key`,
    `${rootUrl}/system/v3.0/pub-key`
  ];

  let lastError = null;
  for (const url of candidateUrls) {
    try {
      const response = await apiRequest("user password public key", url, {
        expectedStatuses: [200]
      });
      return extractPublicKey(response);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ManageOneError) || !/HTTP 404|Route Not Found|usable public key|include a public key/i.test(error.message)) {
        throw error;
      }
    }
  }

  throw lastError || new ManageOneError("user password public key", "No candidate endpoint was provided");
}

export async function createTenantUser(vdcId, { username, email, phoneNumber, plaintextPassword }) {
  const cfg = config();
  const encodedVdcId = encodeURIComponent(vdcId);
  const contact = manageOneUserContact({ email, phoneNumber });
  const candidateRequests = [
    {
      url: `${cfg.baseUrl}/v3.2/vdcs/${encodedVdcId}/users`,
      body: {
        user: {
          name: username,
          display_name: "",
          auth_type: "0",
          access_mode: "0",
          ...contact,
          password: plaintextPassword,
          is_encrypt: false
        }
      }
    },
    {
      url: `${cfg.baseUrl}/v3.0/users`,
      body: {
        tenant_id: vdcId,
        user: {
          name: username,
          ...contact,
          password: plaintextPassword
        }
      }
    }
  ];

  let lastError = null;

  for (const candidate of candidateRequests) {
    try {
      const response = await apiRequest("create tenant user", candidate.url, {
        method: "POST",
        body: candidate.body,
        expectedStatuses: [200, 201]
      });

      const user = response?.user || {};
      if (!user.id) {
        throw new ManageOneError("create tenant user", "Response did not include user.id", safeDetail(response));
      }

      return { userId: user.id };
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(`[MANAGEONE] create tenant user candidate failed: ${candidate.url} => ${safeDetail(detail)}`);

      if (isDuplicateUsernameError(error)) {
        throw error;
      }

      if (
        !(error instanceof ManageOneError) ||
        !/HTTP 400|HTTP 404|HTTP 405|Route Not Found|Method Not Allowed|project\.id|user\.id/i.test(error.message)
      ) {
        throw error;
      }
    }
  }

  throw lastError || new ManageOneError("create tenant user", "No candidate endpoint succeeded");
}

export async function deleteTenantVdc(vdcId) {
  const cfg = config();
  await apiRequest("delete tenant/VDC", `${cfg.baseUrl}/v3.0/vdcs/${encodeURIComponent(vdcId)}?is_domain=true`, {
    method: "DELETE",
    expectedStatuses: [200, 202, 204]
  });
}

async function cleanupCreatedTenantVdc(vdcId, tenantName, originalError) {
  try {
    await deleteTenantVdc(vdcId);
    console.warn(`[MANAGEONE] Rolled back tenant ${tenantName} after duplicate username failure`);
  } catch (cleanupError) {
    const detail = cleanupError instanceof Error ? cleanupError.message : String(cleanupError || "Unknown error");
    console.error(
      `[MANAGEONE] Failed to roll back tenant ${tenantName} after duplicate username failure: ${safeDetail(detail)}`
    );
    console.error(`[MANAGEONE] Original duplicate username failure: ${safeDetail(originalError.message)}`);
  }
}

export async function assertTenantUsernameAvailable(username) {
  const cfg = config();
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    throw new ManageOneError("check tenant username", "Username is required");
  }

  const encodedUsername = encodeURIComponent(normalizedUsername);
  const candidateUrls = [
    `${cfg.authBaseUrl}/v3/users?name=${encodedUsername}`,
    `${cfg.baseUrl}/v3.2/users?name=${encodedUsername}`,
    `${cfg.baseUrl}/v3.0/users?name=${encodedUsername}`
  ];
  let checkedAnyEndpoint = false;

  for (const url of candidateUrls) {
    try {
      const response = await apiRequest("check tenant username", url, {
        method: "GET",
        expectedStatuses: [200]
      });
      checkedAnyEndpoint = true;
      const users = Array.isArray(response?.users)
        ? response.users
        : Array.isArray(response?.user)
          ? response.user
          : [];
      const usernameExists = users.some(
        (user) => String(user?.name || "").trim().toLowerCase() === normalizedUsername
      );

      if (usernameExists) {
        throw new ManageOneError(
          "check tenant username",
          `Username ${normalizedUsername} already exists in ManageOne`
        );
      }
    } catch (error) {
      if (
        error instanceof ManageOneError &&
        /already exists in ManageOne/i.test(error.message)
      ) {
        throw error;
      }

      if (
        !(error instanceof ManageOneError) ||
        !/HTTP 400|HTTP 403|HTTP 404|HTTP 405|Route Not Found|Method Not Allowed|required permissions/i.test(
          error.message
        )
      ) {
        throw error;
      }
    }
  }

  if (!checkedAnyEndpoint) {
    console.warn(
      `[MANAGEONE] Username availability preflight skipped for ${normalizedUsername}; no supported lookup endpoint succeeded`
    );
  }
}

export async function updateTenantUserContactAndMfa(userId, { email, phoneNumber }) {
  const cfg = config();
  const contact = cfg.bindUserContact ? manageOneUserContact({ email, phoneNumber }) : {};
  const user = {
    ...contact
  };

  if (cfg.enableUserMfa) {
    user.mfa_status = true;
  }

  if (!Object.keys(user).length) {
    return;
  }

  try {
    await updateTenantUser(userId, user);
  } catch (error) {
    if (!isDuplicatePhoneError(error) || !contact.phone || !contact.email) {
      throw error;
    }

    const emailOnlyUser = {
      email: contact.email
    };

    if (cfg.enableUserMfa) {
      emailOnlyUser.mfa_status = true;
    }

    console.warn(
      `[MANAGEONE] Tenant user phone already exists for ${userId}; retrying contact sync with email only`
    );
    await updateTenantUser(userId, emailOnlyUser);
    console.log(
      `[MANAGEONE] Tenant user contact synced for ${userId} email=true phone=false mfa=${Boolean(emailOnlyUser.mfa_status)}`
    );
    return;
  }

  console.log(
    `[MANAGEONE] Tenant user contact synced for ${userId} email=${Boolean(contact.email)} phone=${Boolean(contact.phone)} mfa=${Boolean(user.mfa_status)}`
  );
}

async function updateTenantUser(userId, user) {
  const cfg = config();
  await apiRequest("update tenant user contact", `${cfg.baseUrl}/v3.2/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: {
      user
    },
    expectedStatuses: [200, 204]
  });
}

export async function bindUserToGroup(userId, groupId, vdcId) {
  const cfg = config();
  const rootUrl = cfg.baseUrl.replace(/\/vdc$/, "");
  const encodedUserId = encodeURIComponent(userId);
  const encodedGroupId = encodeURIComponent(groupId);
  const encodedVdcId = encodeURIComponent(vdcId);
  const documentedGroupBindUrl = `${cfg.baseUrl}/v3.2/groups/${encodedGroupId}/users/${encodedUserId}`;
  const iamGroupBindUrl = `${cfg.authBaseUrl}/v3/groups/${encodedGroupId}/users/${encodedUserId}`;

  try {
    await apiRequest("bind user to group", documentedGroupBindUrl, {
      method: "PUT",
      expectedStatuses: [200, 204]
    });
    return;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "Unknown error");
    console.warn(`[MANAGEONE] bind user to group documented candidate failed: ${documentedGroupBindUrl} => ${safeDetail(detail)}`);

    if (!(error instanceof ManageOneError) || !/HTTP 404|Route Not Found|HTTP 405|Method Not Allowed/i.test(error.message)) {
      throw error;
    }
  }

  const groupCentricCandidateUrls = [
    `${rootUrl}/vdc-server/v3/groups/${encodedGroupId}/users`,
    `${rootUrl}/vdc/v3/groups/${encodedGroupId}/users`,
    `${cfg.baseUrl}/v3.2/vdcs/${encodedVdcId}/groups/${encodedGroupId}/users`
  ];

  try {
    await firstSuccessfulApiRequest("bind user to group", groupCentricCandidateUrls, {
      method: "PUT",
      body: {
        users: {
          add: [userId],
          del: []
        }
      },
      expectedStatuses: [200, 204]
    });
    return;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "Unknown error");
    console.warn(`[MANAGEONE] bind user to group group-centric candidates failed: ${safeDetail(detail)}`);
  }

  try {
    await apiRequest("bind user to group", iamGroupBindUrl, {
      method: "PUT",
      expectedStatuses: [200, 204]
    });
    return;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "Unknown error");
    console.warn(`[MANAGEONE] bind user to group IAM candidate failed: ${iamGroupBindUrl} => ${safeDetail(detail)}`);

    if (!(error instanceof ManageOneError) || !/HTTP 404|Route Not Found|HTTP 405|Method Not Allowed/i.test(error.message)) {
      throw error;
    }
  }

  const candidateUrls = [
    `${rootUrl}/vdc-server/v3/users/${encodedUserId}/groups`,
    `${rootUrl}/vdc/v3/users/${encodedUserId}/groups`,
    `${cfg.baseUrl}/v3.2/vdcs/${encodedVdcId}/users/${encodedUserId}/groups`
  ];

  await firstSuccessfulApiRequest("bind user to group", candidateUrls, {
    method: "PUT",
    body: {
      groups: {
        add: [groupId],
        del: []
      }
    },
    expectedStatuses: [200, 204]
  });
}

async function apiRequest(step, url, options = {}) {
  const { session: providedSession, ...requestOptions } = options;
  let session = providedSession || (await authenticate());

  try {
    const response = await request(step, url, {
      cfg: config(),
      ...requestOptions,
      headers: {
        ...(requestOptions.headers || {}),
        "X-Auth-Token": session.token
      }
    });
    return response.body;
  } catch (error) {
    if (!providedSession && isSessionExpired(error)) {
      session = await authenticate({ force: true });
      const response = await request(step, url, {
        cfg: config(),
        ...requestOptions,
        headers: {
          ...(requestOptions.headers || {}),
          "X-Auth-Token": session.token
        }
      });
      return response.body;
    }
    throw error;
  }
}

async function firstSuccessfulApiRequest(step, urls, options = {}) {
  let lastError = null;
  const failures = [];

  for (const url of urls) {
    try {
      return await apiRequest(step, url, options);
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error || "Unknown error");
      failures.push(`${url} => ${safeDetail(detail)}`);
      console.warn(`[MANAGEONE] ${step} candidate failed: ${url} => ${safeDetail(detail)}`);

      if (!(error instanceof ManageOneError) || !/HTTP 404|Route Not Found|Unexpected HTTP 200.*authui\/login/i.test(error.message)) {
        throw error;
      }
    }
  }

  if (lastError) {
    const detail = failures.length ? failures.join(" | ") : lastError.message;
    throw new ManageOneError(step, "No candidate endpoint succeeded", detail);
  }

  throw new ManageOneError(step, "No candidate endpoint was provided");
}

async function request(step, url, options = {}) {
  const {
    cfg = config(),
    method = "GET",
    headers = {},
    body,
    expectedStatuses = [200]
  } = options;

  configureTls(cfg);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const hasJsonBody = body && typeof body !== "string";
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json, text/plain, */*",
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body: typeof body === "string" ? body : hasJsonBody ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: controller.signal
    });

    const responseBody = await parseResponseBody(response);
    if (!expectedStatuses.includes(response.status)) {
      throw new ManageOneError(step, `Unexpected HTTP ${response.status}`, safeDetail(responseBody));
    }

    return { status: response.status, headers: response.headers, body: responseBody };
  } catch (error) {
    if (error instanceof ManageOneError) throw error;
    const message = error?.name === "AbortError" ? `Request timed out after ${cfg.timeoutMs}ms` : safeDetail(error?.message);
    throw new ManageOneError(step, message);
  } finally {
    clearTimeout(timeout);
  }
}

function assertConfigured(cfg) {
  const missing = [];
  if (!cfg.username) missing.push("MANAGEONE_USERNAME");
  if (!cfg.password) missing.push("MANAGEONE_PASSWORD");
  if (!cfg.authBaseUrl) missing.push("MANAGEONE_AUTH_BASE_URL");
  if (!cfg.authDomain) missing.push("MANAGEONE_AUTH_DOMAIN");
  if (!cfg.baseUrl) missing.push("MANAGEONE_BASE_URL");
  if (missing.length) {
    throw new ManageOneError("configuration", `Missing required env vars: ${missing.join(", ")}`);
  }
}

function assertExternalNetworkConfigured(cfg) {
  const missing = [];
  if (!cfg.externalNetworkUsername) missing.push("MANAGEONE_EXTERNAL_NETWORK_USERNAME");
  if (!cfg.externalNetworkPassword) missing.push("MANAGEONE_EXTERNAL_NETWORK_PASSWORD");
  if (!cfg.authBaseUrl) missing.push("MANAGEONE_AUTH_BASE_URL");
  if (!cfg.externalNetworkAuthDomain) missing.push("MANAGEONE_EXTERNAL_NETWORK_AUTH_DOMAIN");
  if (!cfg.baseUrl) missing.push("MANAGEONE_BASE_URL");
  if (missing.length) {
    throw new ManageOneError("external network configuration", `Missing required env vars: ${missing.join(", ")}`);
  }
}

function configureTls(cfg) {
  if (!cfg.rejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

function tokenExpiresAt(responseBody, cfg) {
  const expiresAt = responseBody?.token?.expires_at ? Date.parse(responseBody.token.expires_at) : NaN;
  if (Number.isFinite(expiresAt)) {
    return Math.max(Date.now(), expiresAt - TOKEN_EXPIRY_SKEW_MS);
  }

  return Date.now() + cfg.tokenTtlMs;
}

function encryptPassword(plaintextPassword, publicKey) {
  if (!plaintextPassword) {
    throw new ManageOneError("password encryption", "No password was provided");
  }

  try {
    return crypto
      .publicEncrypt(
        {
          key: normalizePublicKey(publicKey),
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(plaintextPassword, "utf8")
      )
      .toString("hex");
  } catch (error) {
    throw new ManageOneError("password encryption", safeDetail(error?.message));
  }
}

function extractPublicKey(responseBody) {
  if (typeof responseBody === "string") {
    const trimmed = responseBody.trim();
    if (trimmed.startsWith("{")) {
      try {
        return extractPublicKey(JSON.parse(trimmed));
      } catch {
        // Fall through and validate the string as a direct public key.
      }
    }

    if (!/BEGIN PUBLIC KEY|^[A-Za-z0-9+/=\s-]+$/.test(trimmed)) {
      throw new ManageOneError("public key", "Response did not include a usable public key");
    }

    return trimmed;
  }
  const publicKey =
    responseBody?.pub_key ||
    responseBody?.pubKey ||
    responseBody?.pubkey ||
    responseBody?.publicKey ||
    responseBody?.data?.pub_key ||
    responseBody?.data?.pubKey;

  if (!publicKey) {
    throw new ManageOneError("public key", "Response did not include a public key");
  }
  return publicKey;
}

function normalizePublicKey(publicKey) {
  const body = String(publicKey || "")
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");

  if (!body) {
    throw new ManageOneError("public key", "Public key body was empty");
  }

  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

async function parseResponseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isSessionExpired(error) {
  return error instanceof ManageOneError && /HTTP 401|HTTP 403|session|expired|unauthorized/i.test(error.message);
}

function isPermissionDenied(error) {
  return error instanceof ManageOneError && /HTTP 403|required permissions|mocomm-00001/i.test(error.message);
}

function isDuplicatePhoneError(error) {
  return error instanceof ManageOneError && /movdc-01111|phone number already exists/i.test(error.message);
}

function isDuplicateUsernameError(error) {
  return error instanceof ManageOneError && /movdc-01109|username already exists/i.test(error.message);
}

function manageOneUserContact({ email, phoneNumber }) {
  const contact = {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const phone = parseManageOnePhone(phoneNumber);

  if (normalizedEmail) {
    contact.email = normalizedEmail.slice(0, 128);
  }

  if (phone) {
    contact.areacode = phone.areacode;
    contact.phone = phone.phone;
  }

  return contact;
}

function normalizeTenantName(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || `tenant-${Date.now()}`;
}

function defaultResourceSpaceName(tenantName, regionId) {
  const regionPrefix = `${regionId}_`;
  const safeTenant = String(tenantName || "tenant")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return `${regionPrefix}${safeTenant || "tenant"}`.slice(0, 64).replace(/[^a-z0-9]+$/i, "") || regionPrefix + "tenant";
}

function configuredRegions() {
  const requestedProfile = String(process.env.MANAGEONE_REGION_PROFILE || "hoa")
    .trim()
    .toLowerCase();
  const profileNames = requestedProfile === "both"
    ? ["hoa", "hq3"]
    : [REGION_PROFILES[requestedProfile] ? requestedProfile : "hoa"];

  return profileNames.map((profileName) => configuredRegion(profileName));
}

function configuredRegion(profileName) {
  const profile = REGION_PROFILES[profileName];
  const prefix = profile.envPrefix;
  const useLegacyRegionEnv = profileName === "hoa";

  const region = {
    profileName,
    regionId:
      process.env[`${prefix}_REGION_ID`] ||
      (useLegacyRegionEnv ? process.env.MANAGEONE_REGION_ID : "") ||
      profile.regionId,
    cloudInfraId:
      process.env[`${prefix}_CLOUD_INFRA_ID`] ||
      (useLegacyRegionEnv ? process.env.MANAGEONE_CLOUD_INFRA_ID : "") ||
      profile.cloudInfraId,
    azKvm:
      process.env[`${prefix}_AZ_KVM`] ||
      (useLegacyRegionEnv ? process.env.MANAGEONE_AZ_KVM : "") ||
      profile.azKvm,
    azBms:
      process.env[`${prefix}_AZ_BMS`] ||
      (useLegacyRegionEnv ? process.env.MANAGEONE_AZ_BMS : "") ||
      profile.azBms,
    externalNetworks: profile.externalNetworks,
    externalNetworkEnvPrefix: useLegacyRegionEnv ? "MANAGEONE" : prefix
  };

  return {
    ...region,
    externalNetworks: configuredExternalNetworks(region)
  };
}

function configuredExternalNetworks(region) {
  const prefix = region.externalNetworkEnvPrefix;
  const networks = [
    {
      id: process.env[`${prefix}_VPC_EXTERNAL_NETWORK_ID`] || region.externalNetworks[0].id,
      name: process.env[`${prefix}_VPC_EXTERNAL_NETWORK_NAME`] || region.externalNetworks[0].name
    },
    {
      id: process.env[`${prefix}_EIP_EXTERNAL_NETWORK_ID`] || region.externalNetworks[1].id,
      name: process.env[`${prefix}_EIP_EXTERNAL_NETWORK_NAME`] || region.externalNetworks[1].name
    }
  ];

  return networks.filter((network) => network.id && network.name);
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeDetail(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return serialized
    .replace(/("password"\s*:\s*")[^"]+/gi, "$1[REDACTED]")
    .replace(/(password=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(X-Auth-Token:\s*)[^\n]+/gi, "$1[REDACTED]")
    .replace(/(x-subject-token:\s*)[^\n]+/gi, "$1[REDACTED]")
    .slice(0, MAX_RESPONSE_DETAIL_LENGTH);
}
