// Use the studio workspace's Tailwind 3 compiler for this app's v3 directives.
module.exports = {
  plugins: {
    [require.resolve('tailwindcss', { paths: [require('path').join(__dirname, 'packages/studio')] })]: {},
    autoprefixer: {},
  },
};
