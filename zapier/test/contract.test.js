// Live Zaps are bound to these keys, fields, choices and samples. If this snapshot fails, the
// change breaks existing users: revert it, or ship it as a new trigger. See CLAUDE.md.
const { App } = require('./helpers');

const contract = () => ({
  authentication: {
    type: App.authentication.type,
    fields: App.authentication.fields,
  },
  triggers: Object.fromEntries(
    Object.keys(App.triggers)
      .sort()
      .map((key) => {
        const { noun, display, operation } = App.triggers[key];
        return [
          key,
          {
            key: App.triggers[key].key,
            noun,
            display,
            type: operation.type,
            canPaginate: operation.canPaginate,
            inputFields: operation.inputFields,
            outputFields: operation.outputFields,
            sample: operation.sample,
          },
        ];
      })
  ),
});

describe('user-facing contract', () => {
  it('matches the snapshot', () => {
    expect(contract()).toMatchSnapshot();
  });

  it('keeps the auth field key api_key', () => {
    expect(App.authentication.fields.map((field) => field.key)).toEqual(['api_key']);
  });
});
