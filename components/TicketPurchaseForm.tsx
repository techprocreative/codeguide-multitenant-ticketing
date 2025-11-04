'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Ticket, Calendar, MapPin, DollarSign, User, Phone, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenantContext } from '@/components/TenantSelector';
import { format } from 'date-fns';

// Form validation schema
const ticketPurchaseSchema = z.object({
  eventId: z.string().min(1, 'Please select an event'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(10, 'Maximum 10 tickets per purchase'),
  userName: z.string().min(1, 'Name is required'),
  userEmail: z.string().email('Invalid email address'),
  userPhone: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'tripay']),
});

type TicketPurchaseForm = z.infer<typeof ticketPurchaseSchema>;

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  venue?: string;
  price: number;
  max_tickets?: number;
  sold_tickets: number;
  status: string;
}

interface PaymentChannel {
  code: string;
  name: string;
  icon: string;
  active: boolean;
  fee: {
    flat: number;
    percent: number;
  };
}

async function fetchEvents(apiUrl: string): Promise<Event[]> {
  const response = await fetch(apiUrl('/events'));
  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }
  const data = await response.json();
  return data.data.events || [];
}

async function fetchPaymentChannels(): Promise<PaymentChannel[]> {
  const response = await fetch('/api/demo-events/tickets/purchase');
  if (!response.ok) {
    throw new Error('Failed to fetch payment channels');
  }
  const data = await response.json();
  return data.data || [];
}

async function purchaseTickets(apiUrl: string, headers: Record<string, string>, data: TicketPurchaseForm) {
  const response = await fetch(apiUrl('/tickets/purchase'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      eventId: data.eventId,
      quantity: data.quantity,
      user: {
        name: data.userName,
        email: data.userEmail,
        phone: data.userPhone,
      },
      paymentInfo: {
        method: data.paymentMethod,
        amount: 0, // Will be calculated on the server
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to purchase tickets');
  }

  return response.json();
}

interface TicketPurchaseFormProps {
  onSuccess?: (result: any) => void;
  className?: string;
}

export function TicketPurchaseForm({ onSuccess, className }: TicketPurchaseFormProps) {
  const { getApiUrl, getHeaders, tenant } = useTenantContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TicketPurchaseForm>({
    resolver: zodResolver(ticketPurchaseSchema),
    defaultValues: {
      eventId: '',
      quantity: 1,
      userName: '',
      userEmail: '',
      userPhone: '',
      paymentMethod: 'cash',
    },
  });

  const selectedEventId = form.watch('eventId');
  const quantity = form.watch('quantity');
  const paymentMethod = form.watch('paymentMethod');

  // Fetch events
  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ['events', tenant],
    queryFn: () => fetchEvents(getApiUrl),
    enabled: !!tenant,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch payment channels
  const {
    data: paymentChannels = [],
    isLoading: channelsLoading,
  } = useQuery({
    queryKey: ['payment-channels'],
    queryFn: fetchPaymentChannels,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get selected event details
  const selectedEvent = events.find(event => event.id === selectedEventId);

  // Calculate total price
  const totalPrice = selectedEvent ? selectedEvent.price * quantity : 0;

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: (data: TicketPurchaseForm) => purchaseTickets(getApiUrl, getHeaders(), data),
    onSuccess: (result) => {
      toast({
        title: 'Tickets Purchased!',
        description: `Successfully purchased ${quantity} ticket(s) for ${selectedEvent?.title}`,
      });

      // Invalidate events query to refresh sold tickets count
      queryClient.invalidateQueries({ queryKey: ['events', tenant] });

      // Reset form
      form.reset();

      // Call success callback
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: 'Purchase Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: TicketPurchaseForm) => {
    if (!tenant) {
      toast({
        title: 'Error',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }

    purchaseMutation.mutate(data);
  };

  if (!tenant) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Purchase Tickets
          </CardTitle>
          <CardDescription>
            Select a tenant to purchase tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Please select a tenant from the selector above to purchase tickets.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (eventsError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Purchase Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-destructive mb-2">
              Failed to load events
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Purchase Tickets
        </CardTitle>
        <CardDescription>
          Buy tickets for events in {tenant}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Event Selection */}
            <FormField
              control={form.control}
              name="eventId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Event</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={eventsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an event..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {events
                        .filter(event => event.status === 'upcoming' || event.status === 'ongoing')
                        .map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{event.title}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(event.date), 'MMM dd, yyyy HH:mm')}
                                {event.venue && (
                                  <>
                                    <MapPin className="h-3 w-3" />
                                    {event.venue}
                                  </>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Event Details */}
            {selectedEvent && (
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{selectedEvent.title}</span>
                      <Badge variant={selectedEvent.status === 'upcoming' ? 'default' : 'secondary'}>
                        {selectedEvent.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(selectedEvent.date), 'PPP p')}
                      </div>
                      {selectedEvent.venue && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          {selectedEvent.venue}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3" />
                        ${selectedEvent.price.toFixed(2)} per ticket
                      </div>
                      {selectedEvent.max_tickets && (
                        <div className="flex items-center gap-2">
                          <Ticket className="h-3 w-3" />
                          {selectedEvent.max_tickets - selectedEvent.sold_tickets} tickets remaining
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value.toString()}
                    disabled={!selectedEvent}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select quantity..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from(
                        { length: Math.min(10, selectedEvent?.max_tickets ? selectedEvent.max_tickets - selectedEvent.sold_tickets : 10) },
                        (_, i) => i + 1
                      ).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} ticket{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Attendee Information</h3>

              <FormField
                control={form.control}
                name="userName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Enter your phone number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Card
                        </div>
                      </SelectItem>
                      <SelectItem value="transfer">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Bank Transfer
                        </div>
                      </SelectItem>
                      {paymentChannels.length > 0 && (
                        <SelectItem value="tripay">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Online Payment (Tripay)
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Price */}
            {selectedEvent && (
              <Card className="bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Price:</span>
                    <span className="text-2xl font-bold text-primary">
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!selectedEvent || purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Purchase Tickets'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}