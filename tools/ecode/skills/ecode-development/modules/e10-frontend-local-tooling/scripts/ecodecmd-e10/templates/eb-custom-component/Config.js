const Config = () => Promise.resolve({
  items: {
    content: {
      label: '内容',
      itemType: 'TEXTAREA',
      style: { width: '100%', height: '200px' },
      resizable: false,
    },
  },
  formatFormDatas: (data) => ({ ...data }),
});

export default Config;
