'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface TenantSelectorProps {
  onTenantChange?: (tenant: Tenant | null) => void;
  selectedTenant?: string | null;
  className?: string;
}

async function fetchTenants(): Promise<Tenant[]> {
  const response = await fetch('/api/tenants');
  if (!response.ok) {
    throw new Error('Failed to fetch tenants');
  }
  const data = await response.json();
  return data.tenants || [];
}

export function TenantSelector({ onTenantChange, selectedTenant, className }: TenantSelectorProps) {
  const [currentTenant, setCurrentTenant] = useState<string | null>(selectedTenant || null);
  const { toast } = useToast();

  const {
    data: tenants,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  useEffect(() => {
    // Set initial tenant from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenant = urlParams.get('tenant');
    const storedTenant = localStorage.getItem('selected-tenant');

    if (urlTenant) {
      setCurrentTenant(urlTenant);
      localStorage.setItem('selected-tenant', urlTenant);
    } else if (storedTenant) {
      setCurrentTenant(storedTenant);
    }
  }, []);

  const handleTenantChange = (tenantSlug: string) => {
    setCurrentTenant(tenantSlug);
    localStorage.setItem('selected-tenant', tenantSlug);

    // Update URL without page reload
    const url = new URL(window.location.href);
    if (tenantSlug) {
      url.searchParams.set('tenant', tenantSlug);
    } else {
      url.searchParams.delete('tenant');
    }
    window.history.replaceState({}, '', url.toString());

    // Find tenant object and call callback
    if (tenants) {
      const selectedTenantData = tenants.find(t => t.slug === tenantSlug) || null;
      onTenantChange?.(selectedTenantData);
    }

    toast({
      title: 'Tenant Changed',
      description: `Switched to ${tenantSlug ? tenantSlug : 'no tenant'}`,
    });
  };

  const activeTenants = tenants?.filter(tenant => tenant.status === 'active') || [];

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Tenant
          </CardTitle>
          <CardDescription>
            Choose a tenant to manage their events and tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Failed to load tenants
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Select Tenant
        </CardTitle>
        <CardDescription>
          Choose a tenant to manage their events and tickets
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading tenants...</span>
          </div>
        ) : activeTenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              No active tenants available
            </p>
            <p className="text-xs text-muted-foreground">
              Please contact an administrator to set up tenants
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              value={currentTenant || ''}
              onValueChange={handleTenantChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {activeTenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.slug}>
                    <div className="flex flex-col">
                      <span className="font-medium">{tenant.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tenant.slug}
                        {tenant.domain && ` • ${tenant.domain}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentTenant && (
              <div className="text-xs text-muted-foreground">
                Currently managing: <strong>{currentTenant}</strong>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {activeTenants.length} active tenant{activeTenants.length !== 1 ? 's' : ''} available
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook to get current tenant
export function useCurrentTenant() {
  const [currentTenant, setCurrentTenant] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selected-tenant');
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenant = urlParams.get('tenant');

    setCurrentTenant(urlTenant || stored);
  }, []);

  return currentTenant;
}

// Hook to get tenant context for API calls
export function useTenantContext() {
  const currentTenant = useCurrentTenant();

  const getApiUrl = (path: string) => {
    if (!currentTenant) {
      throw new Error('No tenant selected');
    }
    return `/api/${currentTenant}${path}`;
  };

  const getHeaders = () => {
    if (!currentTenant) {
      throw new Error('No tenant selected');
    }
    return {
      'x-tenant-slug': currentTenant,
    };
  };

  return {
    tenant: currentTenant,
    getApiUrl,
    getHeaders,
    isAuthenticated: !!currentTenant,
  };
}