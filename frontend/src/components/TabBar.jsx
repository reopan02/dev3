import React from 'react';
import Tab from './Tab';

function TabBar({ tabs, activeTabId, onTabChange, onAddTab, onCloseTab, maxTabs = 5 }) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onClick={() => onTabChange(tab.id)}
          onClose={onCloseTab}
          canClose={tabs.length > 1}
        />
      ))}
      <button
        className="add-tab-button"
        onClick={onAddTab}
        disabled={tabs.length >= maxTabs}
        title={tabs.length >= maxTabs ? `最多支持${maxTabs}个标签` : '新建标签'}
      >
        +
      </button>
    </div>
  );
}

export default TabBar;
