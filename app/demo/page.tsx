'use client';

import { useState } from 'react';
import { TenantSelector, useTenantContext } from '@/components/TenantSelector';
import { TicketPurchaseForm } from '@/components/TicketPurchaseForm';
import { GateScanner } from '@/components/GateScanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Ticket, QrCode, Settings, AlertCircle } from 'lucide-react';

export default function DemoPage() {
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const { tenant } = useTenantContext();

  const handleTicketPurchaseSuccess = (result: any) => {
    console.log('Ticket purchase successful:', result);
    // You could show success details, redirect to tickets page, etc.
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Multi-Tenant Ticketing System</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A complete online ticketing solution with multi-tenant architecture,
          QR code validation, and payment processing.
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="secondary">Multi-Tenant</Badge>
          <Badge variant="secondary">QR Validation</Badge>
          <Badge variant="secondary">Payment Processing</Badge>
          <Badge variant="secondary">Real-time Scanning</Badge>
        </div>
      </div>

      {/* Alert for Demo */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-blue-900">Demo Environment</h4>
              <p className="text-sm text-blue-700">
                This is a demonstration of the multi-tenant ticketing system.
                The payment processing and QR scanning are simulated for demo purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Selection */}
      <div className="max-w-md mx-auto">
        <TenantSelector
          onTenantChange={setSelectedTenant}
          selectedTenant={tenant}
        />
      </div>

      {tenant && (
        <>
          <Separator />

          {/* Main Content */}
          <Tabs defaultValue="purchase" className="w-full max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="purchase" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Purchase Tickets
              </TabsTrigger>
              <TabsTrigger value="scan" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Gate Scanner
              </TabsTrigger>
              <TabsTrigger value="info" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                System Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchase" className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Purchase Tickets</h2>
                <p className="text-muted-foreground">
                  Buy tickets for events in {tenant}
                </p>
              </div>

              <div className="max-w-2xl mx-auto">
                <TicketPurchaseForm onSuccess={handleTicketPurchaseSuccess} />
              </div>
            </TabsContent>

            <TabsContent value="scan" className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Gate Scanner</h2>
                <p className="text-muted-foreground">
                  Validate tickets using QR code scanning
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <GateScanner gateId="demo-gate-1" />
              </div>
            </TabsContent>

            <TabsContent value="info" className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">System Information</h2>
                <p className="text-muted-foreground">
                  Technical details about the multi-tenant architecture
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Tenant Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium">Schema-per-Tenant Model</h4>
                      <p className="text-sm text-muted-foreground">
                        Each tenant gets an isolated PostgreSQL schema with dedicated tables.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Current Tenant</h4>
                      <p className="text-sm text-muted-foreground">
                        {tenant} - Active and ready for operations
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">API Endpoints</h4>
                      <p className="text-sm text-muted-foreground">
                        All tenant-specific APIs are prefixed with /api/[tenantId]/
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      Ticket Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium">QR Code Generation</h4>
                      <p className="text-sm text-muted-foreground">
                        Secure QR codes with digital signatures and timestamps.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">PDF Tickets</h4>
                      <p className="text-sm text-muted-foreground">
                        Professional PDF tickets with QR codes for download.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Payment Integration</h4>
                      <p className="text-sm text-muted-foreground">
                        Support for Tripay payment gateway and manual payment methods.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      Validation System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium">Real-time Validation</h4>
                      <p className="text-sm text-muted-foreground">
                        Instant ticket validation with comprehensive logging.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Gate Service</h4>
                      <p className="text-sm text-muted-foreground">
                        Dedicated webhook service for gate scanners with HMAC authentication.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Audit Trail</h4>
                      <p className="text-sm text-muted-foreground">
                        Complete scan history with timestamps and gate locations.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Technology Stack
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">Frontend</h4>
                  <p className="text-sm text-muted-foreground">
                    Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Backend</h4>
                  <p className="text-sm text-muted-foreground">
                    Next.js API Routes, PostgreSQL, Supabase, Clerk Authentication
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Integration</h4>
                  <p className="text-sm text-muted-foreground">
                    Tripay Payment Gateway, QR Code Library, PDF Generation
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* API Documentation */}
          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>
                Key API endpoints for the ticketing system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Tenant Management</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li><code>GET /api/tenants</code> - List tenants</li>
                      <li><code>POST /api/tenants</code> - Create tenant</li>
                      <li><code>GET /api/tenants/[slug]</code> - Get tenant</li>
                      <li><code>PUT /api/tenants/[slug]</code> - Update tenant</li>
                      <li><code>DELETE /api/tenants/[slug]</code> - Delete tenant</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Ticket Operations</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li><code>GET /api/[tenant]/events</code> - List events</li>
                      <li><code>POST /api/[tenant]/events</code> - Create event</li>
                      <li><code>GET /api/[tenant]/tickets</code> - List tickets</li>
                      <li><code>POST /api/[tenant]/tickets/purchase</code> - Purchase tickets</li>
                      <li><code>POST /api/[tenant]/tickets/[id]/validate</code> - Validate ticket</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Gate Service</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><code>POST /api/gate/scan</code> - Gate scan webhook</li>
                    <li><code>POST /api/webhooks/tripay</code> - Payment callback</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
      )}
    </div>
  );
}