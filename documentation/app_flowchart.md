flowchart TD
  Start[Start]
  Auth[User Authentication]
  TenantSel[Select Tenant]
  Browse[Browse Events]
  Select[Select Event]
  Purchase[Purchase Ticket]
  Payment[Process Payment]
  Success{Payment Success}
  Record[Create Ticket Record]
  QR[Generate QR Code]
  PDF[Generate PDF Ticket]
  Deliver[Deliver Ticket]
  Scan[Scan Ticket]
  Validate{Valid Ticket}
  Log[Log Gate Entry]
  End[End]

  Start --> Auth
  Auth --> TenantSel
  TenantSel --> Browse
  Browse --> Select
  Select --> Purchase
  Purchase --> Payment
  Payment --> Success
  Success -->|Yes| Record
  Success -->|No| End
  Record --> QR
  QR --> PDF
  PDF --> Deliver
  Deliver --> Scan
  Scan --> Validate
  Validate -->|Valid| Log
  Validate -->|Invalid| End
  Log --> End