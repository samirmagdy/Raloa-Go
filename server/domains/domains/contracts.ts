export type DomainProvisioningState = 'pending' | 'provisioning' | 'verified' | 'failed' | 'deleted';
export type CertificateStatus = 'pending' | 'active' | 'failed';

export type DnsInstruction = {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl?: number;
};

export type DomainRouting = {
  hostname: string;
  siteId: string;
  publishedOnly: true;
};

export type CustomDomain = {
  id: string;
  hostname: string;
  ownerUserId: string;
  siteId: string;
  idempotencyKey: string;
  provisioningState: DomainProvisioningState;
  verificationStatus: 'pending' | 'verified' | 'failed';
  certificateStatus: CertificateStatus;
  dnsInstructions: DnsInstruction[];
  routing: DomainRouting;
  providerHostnameId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export interface DomainRepository {
  get(id: string): Promise<CustomDomain | null>;
  findByHostname(hostname: string): Promise<CustomDomain | null>;
  findByIdempotencyKey(key: string): Promise<CustomDomain | null>;
  listOwned(ownerUserId: string): Promise<CustomDomain[]>;
  create(domain: CustomDomain): Promise<void>;
  update(id: string, changes: Partial<CustomDomain>): Promise<CustomDomain>;
}

export interface DomainProviderAdapter {
  provision(input: { hostname: string; siteId: string; idempotencyKey: string }): Promise<{
    providerHostnameId: string;
    dnsInstructions: DnsInstruction[];
    certificateStatus: CertificateStatus;
  }>;
  verify(providerHostnameId: string): Promise<{ verified: boolean; certificateStatus: CertificateStatus }>;
  remove(providerHostnameId: string): Promise<void>;
}

export interface DomainProvisioningService {
  listOwned(ownerUserId: string): Promise<CustomDomain[]>;
  provision(input: { id: string; ownerUserId: string; siteId: string; hostname: string; idempotencyKey: string }): Promise<CustomDomain>;
  verify(input: { domainId: string; ownerUserId: string }): Promise<CustomDomain>;
  remove(input: { domainId: string; ownerUserId: string }): Promise<void>;
  resolvePublicRouting(hostname: string): Promise<DomainRouting | null>;
}
