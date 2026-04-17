import React, { useState } from 'react';
import TabBar from './TabBar';
import GenerationPanel from '../panels/GenerationPanel';

function GenerationTabContainer({ prompt, onProductInfoRecognized }) {
  const [tabs, setTabs] = useState([
    {
      id: 'tab-1',
      label: 'Generation 1',
      targetImage: null,
      prompt: '',
      aspectRatio: '3:4',
      imageSize: '2K',
      model: 'gemini-3-pro-image-preview',
      generatedImage: null,
      status: 'idle',
      error: null
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleAddTab = () => {
    if (tabs.length >= 5) return;

    const newTabNumber = tabs.length + 1;
    const newTab = {
      id: `tab-${Date.now()}`,
      label: `Generation ${newTabNumber}`,
      targetImage: null,
      prompt: prompt || '',
      aspectRatio: '3:4',
      imageSize: '2K',
      model: 'gemini-3-pro-image-preview',
      generatedImage: null,
      status: 'idle',
      error: null
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId) => {
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  };

  const updateTabData = (tabId, updates) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  };

  return (
    <div>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onAddTab={handleAddTab}
        onCloseTab={handleCloseTab}
        maxTabs={5}
      />
      <div style={{ marginTop: '12px' }}>
        {activeTab && (
          <GenerationPanel
            key={activeTab.id}
            prompt={prompt}
            tabData={activeTab}
            onUpdateTab={(updates) => updateTabData(activeTab.id, updates)}
            onProductInfoRecognized={onProductInfoRecognized}
          />
        )}
      </div>
    </div>
  );
}

export default GenerationTabContainer;
