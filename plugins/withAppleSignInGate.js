const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-apple-authentication adds the Sign in with Apple entitlement as soon as
 * the package is installed. The App Store profile only carries it once the
 * capability is enabled for the App ID, so it is removed unless
 * ios.usesAppleSignIn is explicitly true.
 */
module.exports = function withAppleSignInGate(config) {
  return withEntitlementsPlist(config, (next) => {
    if (next.ios?.usesAppleSignIn !== true) delete next.modResults['com.apple.developer.applesignin'];
    return next;
  });
};
