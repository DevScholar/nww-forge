export default {
  packagerConfig: {
    name: '{{displayName}}',
    executableName: '{{name}}',
  },
  makers: [
    { name: '@nww-forge/maker-zip' },
  ],
};
