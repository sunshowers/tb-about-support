/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 * 
 * The Original Code is Thunderbird about:support.
 * 
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

var AboutSupport = {
  get _protocolSvc() {
    delete this._protocolSvc;
    return this._protocolSvc =
      Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                .getService(Components.interfaces.nsIExternalProtocolService);
  },
  /**
   * Handles links while displaying the about:support page. about: links are
   * opened in a new tab, and anything else is redirected to an external
   * browser. This is modeled after specialTabs.aboutClickHandler().
   */
  clickHandler: function AboutSupport_clickHandler(aEvent) {
    // Don't handle events that: a) aren't trusted, b) have already been
    // handled or c) aren't left-click.
    if (!aEvent.isTrusted || aEvent.getPreventDefault() || aEvent.button)
      return true;

    let href = hRefForClickEvent(aEvent, true);
    if (href) {
      let tabmail = document.getElementById("tabmail");
      let uri = makeURI(href);
      if (uri.schemeIs("about")) {
        aEvent.preventDefault();
        tabmail.openTab("contentTab",
                        {contentPage: href,
                         clickHandler: "specialTabs.aboutClickHandler(event);"});
      }
      else if (!this._protocolSvc.isExposedProtocol(uri.scheme) ||
               uri.schemeIs("http") || uri.schemeIs("https")) {
        aEvent.preventDefault();
        openLinkExternally(href);
      }
    }
  },

  openInNewTab: function AboutSupport_openInNewTab() {
    let tabmail = document.getElementById("tabmail");
    tabmail.openTab("contentTab",
                    {contentPage: "chrome://about-support/content/aboutSupport.xhtml",
                     clickHandler: "AboutSupport.clickHandler(event);" });
  }
};
