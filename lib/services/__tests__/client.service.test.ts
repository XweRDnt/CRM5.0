import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ClientService } from "@/lib/services/client.service";
import { prisma } from "@/lib/utils/db";

describe("ClientService.createClient", () => {
  let clientService: ClientService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create client successfully", async () => {
    const tenant = await createTestTenant("agency-1");
    const result = await clientService.createClient({
      tenantId: tenant.id,
      name: "John Doe",
      email: "john@client.com",
      phone: "+1234567890",
      companyName: "Client Corp",
    });

    expect(result.id).toBeDefined();
    expect(result.tenantId).toBe(tenant.id);
    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john@client.com");
    expect(result.phone).toBe("+1234567890");
    expect(result.companyName).toBe("Client Corp");
  });

  it("should fail if email already exists in same tenant", async () => {
    const tenant = await createTestTenant("agency-2");
    await clientService.createClient({
      tenantId: tenant.id,
      name: "Client A",
      email: "duplicate@test.com",
    });

    await expect(
      clientService.createClient({
        tenantId: tenant.id,
        name: "Client B",
        email: "duplicate@test.com",
      }),
    ).rejects.toThrow("Client with this email already exists");
  });

  it("should allow same email in different tenants", async () => {
    const tenant1 = await createTestTenant("agency-a");
    const tenant2 = await createTestTenant("agency-b");
    const email = "shared@client.com";

    const client1 = await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client 1",
      email,
    });
    const client2 = await clientService.createClient({
      tenantId: tenant2.id,
      name: "Client 2",
      email,
    });

    expect(client1.id).not.toBe(client2.id);
    expect(client1.tenantId).toBe(tenant1.id);
    expect(client2.tenantId).toBe(tenant2.id);
  });

  it("should fail if tenant does not exist", async () => {
    await expect(
      clientService.createClient({
        tenantId: "nonexistent-tenant-id",
        name: "Client",
        email: "test@test.com",
      }),
    ).rejects.toThrow("Tenant not found");
  });

  it("should validate email format", async () => {
    const tenant = await createTestTenant("agency-3");
    await expect(
      clientService.createClient({
        tenantId: tenant.id,
        name: "Client",
        email: "invalid-email",
      }),
    ).rejects.toThrow("Invalid email format");
  });

  it("should fail when name is empty", async () => {
    const tenant = await createTestTenant("agency-empty");
    await expect(
      clientService.createClient({
        tenantId: tenant.id,
        name: "",
        email: "empty@client.com",
      }),
    ).rejects.toThrow("Name must be between 1 and 200 characters");
  });

  it("should fail when name exceeds 200 characters", async () => {
    const tenant = await createTestTenant("agency-long");
    await expect(
      clientService.createClient({
        tenantId: tenant.id,
        name: "a".repeat(201),
        email: "long@client.com",
      }),
    ).rejects.toThrow("Name must be between 1 and 200 characters");
  });

  it("should store null optional fields when omitted", async () => {
    const tenant = await createTestTenant("agency-nullable");
    const result = await clientService.createClient({
      tenantId: tenant.id,
      name: "Optional Client",
      email: "optional@client.com",
    });

    expect(result.phone).toBeNull();
    expect(result.companyName).toBeNull();
  });
});

describe("ClientService.getClientById", () => {
  let clientService: ClientService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
  });

  it("should return client by id", async () => {
    const tenant = await createTestTenant("agency-4");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Test Client",
      email: "test@client.com",
    });

    const result = await clientService.getClientById(client.id, tenant.id);
    expect(result.id).toBe(client.id);
    expect(result.name).toBe("Test Client");
  });

  it("should fail if client does not exist", async () => {
    const tenant = await createTestTenant("agency-5");
    await expect(clientService.getClientById("nonexistent-id", tenant.id)).rejects.toThrow("Client not found");
  });

  it("should fail if client exists in different tenant", async () => {
    const tenant1 = await createTestTenant("agency-x");
    const tenant2 = await createTestTenant("agency-y");
    const client = await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client",
      email: "client@test.com",
    });

    await expect(clientService.getClientById(client.id, tenant2.id)).rejects.toThrow("Client not found");
  });

  it("should fail if tenant id is empty", async () => {
    const tenant = await createTestTenant("agency-empty-tenant");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client Empty Tenant",
      email: "empty-tenant@client.com",
    });

    await expect(clientService.getClientById(client.id, "")).rejects.toThrow("tenantId is required");
  });
});

describe("ClientService.listClients", () => {
  let clientService: ClientService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
  });

  it("should return all clients for tenant sorted by createdAt DESC", async () => {
    const tenant = await createTestTenant("agency-6");
    await clientService.createClient({
      tenantId: tenant.id,
      name: "Client 1",
      email: "client1@test.com",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await clientService.createClient({
      tenantId: tenant.id,
      name: "Client 2",
      email: "client2@test.com",
    });

    const result = await clientService.listClients(tenant.id);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Client 2");
    expect(result[1].name).toBe("Client 1");
  });

  it("should return empty array if no clients", async () => {
    const tenant = await createTestTenant("agency-7");
    const result = await clientService.listClients(tenant.id);
    expect(result).toEqual([]);
  });

  it("should not return clients from other tenants", async () => {
    const tenant1 = await createTestTenant("agency-m");
    const tenant2 = await createTestTenant("agency-n");
    await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client Tenant 1",
      email: "client1@test.com",
    });
    await clientService.createClient({
      tenantId: tenant2.id,
      name: "Client Tenant 2",
      email: "client2@test.com",
    });

    const result = await clientService.listClients(tenant1.id);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Client Tenant 1");
  });

  it("should fail when tenantId is empty", async () => {
    await expect(clientService.listClients("")).rejects.toThrow("tenantId is required");
  });
});
