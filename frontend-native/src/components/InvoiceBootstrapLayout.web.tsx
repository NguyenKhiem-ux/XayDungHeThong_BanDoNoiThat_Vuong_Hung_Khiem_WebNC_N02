import 'bootstrap/dist/css/bootstrap.min.css';
import { Col, Container, Row } from 'react-bootstrap';
import type { ReactNode } from 'react';

export function InvoiceBootstrapLayout({ children }: { children: ReactNode }) {
  return <Container fluid className="gdv-invoice-bootstrap"><Row><Col>{children}</Col></Row></Container>;
}
