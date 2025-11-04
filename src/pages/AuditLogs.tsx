import { Typography, Alert } from 'antd';

const { Title, Paragraph } = Typography;

export const AuditLogs = () => {
  return (
    <div>
      <Title level={3}>Audit Logs</Title>
      <Alert
        message="Audit Logs Not Available"
        description="The audit logs endpoint is not yet implemented in the backend. This feature will be available once the backend API is ready."
        type="info"
        showIcon
      />
      <Paragraph style={{ marginTop: 16 }}>
        Expected endpoint: <code>GET /api/admin/audit-logs</code>
      </Paragraph>
    </div>
  );
};
