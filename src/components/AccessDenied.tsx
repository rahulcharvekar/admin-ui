import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  message?: string;
  description?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ 
  message = 'Access Denied',
  description = 'You do not have permission to access this resource. Please contact your administrator if you believe this is an error.'
}) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '400px',
      padding: '20px'
    }}>
      <Result
        status="403"
        title={message}
        subTitle={description}
        icon={<LockOutlined style={{ fontSize: '72px', color: '#ff4d4f' }} />}
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        }
      />
    </div>
  );
};
