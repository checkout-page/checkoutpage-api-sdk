const fs = require('fs');
const path = require('path');
const zapier = require('zapier-platform-core');

const { App } = require('./helpers');
const authentication = require('../authentication');
const pkg = require('../package.json');

const triggersDir = path.join(__dirname, '..', 'triggers');
const triggerModules = fs
  .readdirSync(triggersDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => require(path.join(triggersDir, file)));

describe('index.js', () => {
  it('registers every module in triggers/ under its own key', () => {
    expect(Object.keys(App.triggers).sort()).toEqual(triggerModules.map((t) => t.key).sort());
    for (const trigger of triggerModules) {
      expect(App.triggers[trigger.key]).toBe(trigger);
    }
  });

  it('registers 10 polling triggers that can paginate', () => {
    expect(Object.keys(App.triggers)).toHaveLength(10);
    for (const trigger of Object.values(App.triggers)) {
      expect(typeof trigger.operation.perform).toBe('function');
      expect(trigger.operation.canPaginate).toBe(true);
    }
  });

  it('attaches the custom API key authentication', () => {
    expect(App.authentication).toBe(authentication);
    expect(App.authentication.type).toBe('custom');
    expect(typeof App.authentication.test).toBe('function');
  });

  it('takes its version from package.json and its platform version from core', () => {
    expect(App.version).toBe(pkg.version);
    expect(App.platformVersion).toBe(zapier.version);
    expect(App.platformVersion).toBe(pkg.dependencies['zapier-platform-core']);
  });

  it('keeps skipThrowForStatus and an empty request template', () => {
    expect(App.flags).toEqual({ skipThrowForStatus: true });
    expect(App.requestTemplate).toEqual({ params: {}, headers: {} });
  });

  it('defines no actions, searches or middleware', () => {
    expect(App.creates).toBeUndefined();
    expect(App.searches).toBeUndefined();
    expect(App.beforeRequest).toBeUndefined();
    expect(App.afterResponse).toBeUndefined();
  });
});
