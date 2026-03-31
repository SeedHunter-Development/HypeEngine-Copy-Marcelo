import { NextRequest, NextResponse } from "next/server";

const DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.NEXT_PUBLIC_DOMAIN ?? "";

const pixelScript = `
(function(){
  var HE = window.HypeEngine = window.HypeEngine || {};
  var ENDPOINT = "${DOMAIN}/api/track/conversion";

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getUrlParam(name) {
    var url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function getRefCode() {
    return getCookie('he_ref') || getUrlParam('he_ref') || null;
  }

  HE.trackConversion = function(eventType, eventValue, metadata) {
    var refCode = getRefCode();
    if (!refCode) return;
    var payload = {
      refCode: refCode,
      eventType: eventType || 'custom',
      eventValue: eventValue || null,
      metadata: metadata || {}
    };
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(){});
  };

  var refCode = getRefCode();
  if (refCode) {
    HE.trackConversion('pageview', null, { url: window.location.href });
  }
})();
`.trim();

export async function GET() {
  return new NextResponse(pixelScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
