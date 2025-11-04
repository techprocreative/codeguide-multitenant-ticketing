'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Camera, QrCode, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenantContext } from '@/components/TenantSelector';

// Simulated QR scanner (in a real app, you'd use react-qr-reader or similar)
const simulateQRScan = (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Generate a mock QR code string
      const mockQRCode = `TICKET_demo-events_${Math.random().toString(36).substring(2, 18).toUpperCase()}`;
      resolve(mockQRCode);
    }, 2000);
  });
};

async function validateTicket(apiUrl: string, headers: Record<string, string>, ticketId: string, scanData: string, gateId: string) {
  const response = await fetch(`${apiUrl}/tickets/${ticketId}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      scanData,
      gateId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to validate ticket');
  }

  return response.json();
}

interface ValidationResult {
  valid: boolean;
  ticket?: {
    id: string;
    event: {
      id: string;
      title: string;
      date: string;
      venue?: string;
    };
    user: {
      id: string;
      name: string;
      email: string;
    };
    validatedAt?: string;
    gateId?: string;
  };
  reason?: string;
  message?: string;
}

interface GateScannerProps {
  gateId?: string;
  className?: string;
}

export function GateScanner({ gateId = 'gate-1', className }: GateScannerProps) {
  const { getApiUrl, getHeaders, tenant } = useTenantContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanResult, setScanResult] = useState<ValidationResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showResultDialog, setShowResultDialog] = useState(false);

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: ({ ticketId, scanData }: { ticketId: string; scanData: string }) =>
      validateTicket(getApiUrl, getHeaders(), ticketId, scanData, gateId),
    onSuccess: (result: ValidationResult) => {
      setScanResult(result);
      setShowResultDialog(true);

      if (result.valid) {
        toast({
          title: 'Ticket Validated',
          description: result.message || 'Ticket successfully validated',
        });
      } else {
        toast({
          title: 'Validation Failed',
          description: result.reason || 'Ticket validation failed',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Validation Error',
        description: error.message,
        variant: 'destructive',
      });

      setScanResult({
        valid: false,
        reason: error.message,
      });
      setShowResultDialog(true);
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  // Extract ticket ID from QR code (simplified)
  const extractTicketIdFromQR = useCallback((qrData: string): string | null => {
    // In a real implementation, you'd parse the actual QR code format
    // For demo purposes, we'll just extract a mock ticket ID
    const match = qrData.match(/TICKET_[a-z0-9_-]+_([A-F0-9]+)/);
    return match ? match[1] : null;
  }, []);

  // Handle QR code scan
  const handleQRScan = useCallback(async () => {
    if (!tenant) {
      toast({
        title: 'Error',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);

    try {
      // Simulate QR scan (in real app, this would be from camera)
      const qrData = await simulateQRScan();
      const ticketId = extractTicketIdFromQR(qrData);

      if (!ticketId) {
        throw new Error('Invalid QR code format');
      }

      // For demo purposes, use a fixed ticket ID if extraction fails
      const finalTicketId = ticketId.length === 36 ? ticketId : '00000000-0000-0000-0000-000000000000';

      validateMutation.mutate({
        ticketId: finalTicketId,
        scanData: qrData,
      });
    } catch (error) {
      setIsScanning(false);
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Failed to scan QR code',
        variant: 'destructive',
      });
    }
  }, [tenant, extractTicketIdFromQR, validateMutation, toast]);

  // Handle manual code input
  const handleManualSubmit = useCallback(() => {
    if (!manualCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a ticket ID or QR code',
        variant: 'destructive',
      });
      return;
    }

    if (!tenant) {
      toast({
        title: 'Error',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);

    // Try to extract ticket ID from manual input
    let ticketId = manualCode.trim();
    const extractedId = extractTicketIdFromQR(manualCode);

    if (extractedId) {
      ticketId = extractedId;
    }

    // Validate if it's a UUID, otherwise use as-is
    const finalTicketId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ticketId)
      ? ticketId
      : '00000000-0000-0000-0000-000000000000'; // Demo fallback

    validateMutation.mutate({
      ticketId: finalTicketId,
      scanData: manualCode,
    });
  }, [manualCode, tenant, extractTicketIdFromQR, validateMutation, toast]);

  // Handle file upload (QR code image)
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!tenant) {
      toast({
        title: 'Error',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);

    // Simulate processing uploaded QR code
    setTimeout(() => {
      const mockQRData = `TICKET_demo-events_${Math.random().toString(36).substring(2, 18).toUpperCase()}`;
      const ticketId = extractTicketIdFromQR(mockQRData) || '00000000-0000-0000-0000-000000000000';

      validateMutation.mutate({
        ticketId,
        scanData: mockQRData,
      });
    }, 1500);
  }, [tenant, extractTicketIdFromQR, validateMutation]);

  // Reset scan result
  const resetScan = useCallback(() => {
    setScanResult(null);
    setShowResultDialog(false);
    setManualCode('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  if (!tenant) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Gate Scanner
          </CardTitle>
          <CardDescription>
            Scan QR codes to validate tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Please select a tenant to start scanning tickets
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Gate Scanner
          </CardTitle>
          <CardDescription>
            Scan QR codes to validate tickets for {tenant}
          </CardDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Gate: {gateId}</Badge>
            <Badge variant={isScanning ? 'secondary' : 'default'}>
              {isScanning ? 'Scanning...' : 'Ready'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Camera Scan Button */}
          <div className="flex flex-col items-center space-y-4">
            <Button
              onClick={handleQRScan}
              disabled={isScanning}
              className="w-full max-w-xs"
              size="lg"
            >
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Scan QR Code
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Click to simulate camera scan (in production, this would open the camera)
            </div>
          </div>

          {/* File Upload */}
          <div className="flex flex-col items-center space-y-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isScanning}
              className="w-full max-w-xs"
            />
            <div className="text-xs text-muted-foreground">
              Or upload a QR code image
            </div>
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Manual Entry</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter ticket ID or QR code..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                disabled={isScanning}
                className="flex-1"
              />
              <Button
                onClick={handleManualSubmit}
                disabled={isScanning || !manualCode.trim()}
                variant="outline"
              >
                Validate
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Demo Mode:</strong> This is a simulated gate scanner. In production, it would use the device camera to scan actual QR codes and validate them against the API.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.valid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Ticket Valid
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Ticket Invalid
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {scanResult && (
            <div className="space-y-4">
              {scanResult.valid && scanResult.ticket && (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium">Event</h4>
                    <p className="text-sm text-muted-foreground">{scanResult.ticket.event.title}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Attendee</h4>
                    <p className="text-sm text-muted-foreground">
                      {scanResult.ticket.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scanResult.ticket.user.email}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Validation Details</h4>
                    <p className="text-sm text-muted-foreground">
                      Gate: {scanResult.ticket.gateId || gateId}
                    </p>
                    {scanResult.ticket.validatedAt && (
                      <p className="text-sm text-muted-foreground">
                        Time: {new Date(scanResult.ticket.validatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!scanResult.valid && (
                <div>
                  <h4 className="font-medium text-red-600">Reason</h4>
                  <p className="text-sm text-muted-foreground">
                    {scanResult.reason}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={resetScan}
                  className="flex-1"
                >
                  {scanResult.valid ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Scan Next
                    </>
                  ) : (
                    'Try Again'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowResultDialog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}