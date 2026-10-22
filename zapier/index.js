const authentication = require('./authentication');
const newSubscriptionTrigger = require('./triggers/new_subscription.js');
const newPaymentTrigger = require('./triggers/new_payment.js');
const canceledSubscriptionTrigger = require('./triggers/canceled_subscription.js');
const completedSubscriptionTrigger = require('./triggers/completed_subscription.js');
const newSubmissionTrigger = require('./triggers/new_submission.js');
const activeSubscriptionTrigger = require('./triggers/active_subscription.js');
const newSubscriptionPaymentTrigger = require('./triggers/new_subscription_payment.js');
const newAbandonedPaymentTrigger = require('./triggers/new_abandoned_payment.js');
const newAbandonedBookingTrigger = require('./triggers/new_abandoned_booking.js');
const newAbandonedSubscriptionTrigger = require('./triggers/new_abandoned_subscription.js');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  triggers: {
    [newSubscriptionTrigger.key]: newSubscriptionTrigger,
    [newPaymentTrigger.key]: newPaymentTrigger,
    [canceledSubscriptionTrigger.key]: canceledSubscriptionTrigger,
    [completedSubscriptionTrigger.key]: completedSubscriptionTrigger,
    [newSubmissionTrigger.key]: newSubmissionTrigger,
    [activeSubscriptionTrigger.key]: activeSubscriptionTrigger,
    [newSubscriptionPaymentTrigger.key]: newSubscriptionPaymentTrigger,
    [newAbandonedPaymentTrigger.key]: newAbandonedPaymentTrigger,
    [newAbandonedBookingTrigger.key]: newAbandonedBookingTrigger,
    [newAbandonedSubscriptionTrigger.key]: newAbandonedSubscriptionTrigger,
  },
  flags: { skipThrowForStatus: true },
  authentication: authentication,
  requestTemplate: { params: {}, headers: {} },
};
