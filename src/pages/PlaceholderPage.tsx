import React from 'react';
import { Typography, Card } from 'antd';

const { Title } = Typography;

/**
 * Placeholder component for pages under construction
 */
export const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <Card>
      <Title level={2}>{title}</Title>
      <p>This page is under construction. It will be implemented in the next phase.</p>
    </Card>
  );
};
