import React from 'react';

interface ExampleComponentProps {
  title: string;
  description?: string;
}

const ExampleComponent: React.FC<ExampleComponentProps> = ({ title, description }) => {
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center space-x-4">
      <div className="shrink-0">
        <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xl">📝</span>
        </div>
      </div>
      <div>
        <div className="text-xl font-medium text-black">{title}</div>
        {description && <p className="text-gray-500">{description}</p>}
      </div>
    </div>
  );
};

export default ExampleComponent; 