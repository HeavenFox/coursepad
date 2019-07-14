// Facebook Integration
const FB_APP_ID =
  process.env.NODE_ENV === "production" ? "399310256873900" : "399310430207216";

var loadAwaitable, initialized;

/**
 * idempotent
 */
export async function init() {
  if (initialized) {
    return true;
  }

  if (!loadAwaitable) {
    loadAwaitable = new Promise(function(resolve, reject) {
      window.fbAsyncInit = function() {
        window.FB.init({
          appId: FB_APP_ID,
          xfbml: false,
          cookie: false,
          version: "v3.3"
        });
        window.FB.AppEvents.logPageView();
        initialized = true;
        resolve(true);
      };

      (function(d, s, id) {
        var js,
          fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) {
          return;
        }
        js = d.createElement(s);
        js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
      })(document, "script", "facebook-jssdk");
    });
  }

  await loadAwaitable;
  return true;
}
