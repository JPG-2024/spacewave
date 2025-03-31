import React from 'react';
import './VerticalLoading.styles.css'; // We'll create this CSS file next

interface VerticalLoadingLineProps {
  isLoading: boolean;
  width?: string;
  height?: string;
  children?: React.ReactNode;
  lineColor?: string;
  backgroundColor?: string;
  animationDuration?: string;
  lineWidth?: string;
  conditionalRender?: boolean;
}

const VerticalLoadingLine: React.FC<VerticalLoadingLineProps> = ({
  isLoading,
  width = '100%',
  height = '20px',
  children,
  backgroundColor = 'transparent',
  animationDuration = '0.7s',
  lineWidth = '2px',
  conditionalRender = true,
}) => {
  const VerticalLine = () => (
    <div
      className="vertical-loading-container"
      style={{
        width,
        height,
        backgroundColor,
        position: 'relative',
      }}
    >
      <div
        className="vertical-loading-line"
        style={{
          animationDuration,
          width: lineWidth,
        }}
      />
    </div>
  );

  if (!isLoading && conditionalRender) {
    return <>{children}</>;
  }

  if (isLoading && conditionalRender) {
    return <VerticalLine />;
  }

  if (!conditionalRender) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <>
          {isLoading && <VerticalLine />}
          {children}
        </>
      </div>
    );
  }
};

export default VerticalLoadingLine;
