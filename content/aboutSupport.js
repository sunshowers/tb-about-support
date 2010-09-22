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
 * The Original Code is aboutSupport.xhtml.
 * 
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *   Curtis Bartley <cbartley@mozilla.com>
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

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource:///modules/iteratorUtils.jsm");

let gPrefService = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService)
                     .QueryInterface(Ci.nsIPrefBranch2);
let gStringBundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                             .getService(Ci.nsIStringBundleService);
let gMessengerBundle = gStringBundleService.createBundle(
  "chrome://messenger/locale/messenger.properties");

let gSMTPService = Cc["@mozilla.org/messengercompose/smtp;1"]
                     .getService(Ci.nsISmtpService);

// Any nodes marked with this class will be considered part of the UI only,
// and therefore will not be copied. An element can be either CLASS_DATA_UIONLY
// or CLASS_DATA_PRIVATE, but not both.
const CLASS_DATA_UIONLY = "data-uionly";

// Any nodes marked with this class will be considered private and will be
// hidden if the user requests only public data to be shown or copied. An
// element can be either CLASS_DATA_PRIVATE or CLASS_DATA_UIONLY, but not both.
const CLASS_DATA_PRIVATE = "data-private";

const ELLIPSIS = gPrefService.getComplexValue("intl.ellipsis",
                                              Ci.nsIPrefLocalizedString).data;

// We use a preferences whitelist to make sure we only show preferences that
// are useful for support and won't compromise the user's privacy.  Note that
// entries are *prefixes*: for example, "accessibility." applies to all prefs
// under the "accessibility.*" branch.
const PREFS_WHITELIST = [
  "accessibility.",
  "browser.fixup.",
  "browser.history_expire_",
  "browser.link.open_newwindow",
  "browser.mousewheel.",
  "browser.places.",
  "browser.startup.homepage",
  "browser.tabs.",
  "browser.zoom.",
  "dom.",
  "extensions.checkCompatibility",
  "extensions.lastAppVersion",
  "font.",
  "general.useragent.",
  "gfx.color_management.mode",
  "javascript.",
  "keyword.",
  "layout.css.dpi",
  "mail.openMessageBehavior.",
  "mail.spotlight.",
  "mail.winsearch.",
  "mailnews.database.",
  "network.",
  "places.",
  "print.",
  "privacy.",
  "security."
];

// The blacklist, unlike the whitelist, is a list of regular expressions.
const PREFS_BLACKLIST = [
  /^network[.]proxy[.]/,
  /[.]print_to_filename$/,
  /[.]lastFolderIndexedUri/,
];

window.onload = function () {
  // Get the support URL.
  let urlFormatter = Cc["@mozilla.org/toolkit/URLFormatterService;1"]
                       .getService(Ci.nsIURLFormatter);
  let supportUrl = urlFormatter.formatURLPref("app.support.baseURL");

  // Update the application basics section.
  document.getElementById("application-box").textContent = Application.name;
  document.getElementById("version-box").textContent = Application.version;
  document.getElementById("supportLink").href = supportUrl;

  // Update the other sections.
  populatePreferencesSection();
  populateAccountsSection();
  populateExtensionsSection();
}

function populateExtensionsSection() {
  let extensions = Application.extensions.all;
  let trExtensions = [];
  for (let i = 0; i < extensions.length; i++) {
    let extension = extensions[i];
    let tr = createParentElement("tr", [
      createElement("td", extension.name),
      createElement("td", extension.version),
      createElement("td", extension.enabled),
      createElement("td", extension.id),
    ]);
    trExtensions.push(tr);
  }
  appendChildren(document.getElementById("extensions-tbody"), trExtensions);
}

/**
 * Gets details about SMTP servers for a given nsIMsgAccount.
 *
 * @returns A list of records, each record containing the name and other details
 *          about one SMTP server.
 */
function getSMTPDetails(aAccount) {
  let identities = aAccount.identities;
  let defaultIdentity = aAccount.defaultIdentity;
  let smtpDetails = [];

  for each (let identity in fixIterator(identities, Ci.nsIMsgIdentity)) {
    let isDefault = identity == defaultIdentity;
    let smtpServer = {};
    gSMTPService.GetSmtpServerByIdentity(identity, smtpServer);
    smtpDetails.push({name: smtpServer.value.displayname,
                      authMethod: smtpServer.value.authMethod,
                      socketType: smtpServer.value.socketType,
                      isDefault: isDefault});
  }

  return smtpDetails;
}

// Invert nsMsgSocketType and nsMsgAuthMethod so that we can present something
// slightly more descriptive than a mere number. JS really should have object
// comprehensions :(
let gSocketTypes = {};
for each (let [str, index] in Iterator(Ci.nsMsgSocketType))
  gSocketTypes[index] = str;

function getSocketTypeText(aIndex) {
  let plainSocketType = (aIndex in gSocketTypes ?
                         gSocketTypes[aIndex] : aIndex);
  let prettySocketType;
  try {
    prettySocketType = gMessengerBundle.GetStringFromName(
      "smtpServer-ConnectionSecurityType-" + aIndex);
  }
  catch (e if e.result == Components.results.NS_ERROR_FAILURE) {
    // The string wasn't found in the bundle. Make do without it.
    prettySocketType = plainSocketType;
  }
  return [prettySocketType, plainSocketType];
}

let gAuthMethods = {};
for each (let [str, index] in Iterator(Ci.nsMsgAuthMethod))
  gAuthMethods[index] = str;
// l10n properties in messenger.properties corresponding to each auth method
let gAuthMethodProperties = {
  "1": "authOld",
  "2": "authPasswordCleartextInsecurely",
  "3": "authPasswordCleartextViaSSL",
  "4": "authPasswordEncrypted",
  "5": "authKerberos",
  "6": "authNTLM",
  "8": "authAnySecure"
};

function getAuthMethodText(aIndex) {
  let prettyAuthMethod;
  let plainAuthMethod = (aIndex in gAuthMethods ?
                         gAuthMethods[aIndex] : aIndex);
  if (aIndex in gAuthMethodProperties) {
    prettyAuthMethod =
      gMessengerBundle.GetStringFromName(gAuthMethodProperties[aIndex]);
  }
  else {
    prettyAuthMethod = plainAuthMethod;
  }
  return [prettyAuthMethod, plainAuthMethod];
}

function populateAccountsSection() {
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                         .getService(Ci.nsIMsgAccountManager);

  let accounts = accountManager.accounts;
  let trAccounts = [];

  for each (let account in fixIterator(accounts, Ci.nsIMsgAccount)) {
    let server = account.incomingServer;
    let smtpDetails = getSMTPDetails(account);
    let smtpMarkup = [];
    for each ([, smtpServer] in Iterator(smtpDetails)) {
      let [prettySocketType, plainSocketType] = getSocketTypeText(
        smtpServer.socketType);
      let [prettyAuthMethod, plainAuthMethod] = getAuthMethodText(
        smtpServer.authMethod);
      smtpMarkup.push([createElement("td", smtpServer.name),
                       createElement("td", prettySocketType, null, plainSocketType),
                       createElement("td", prettyAuthMethod, null, plainAuthMethod),
                       createElement("td", smtpServer.isDefault)]);
    }

    // smtpMarkup might not be configured, in which case add one dummy element
    // to it to appease the HTML gods below.
    if (smtpMarkup.length == 0)
      smtpMarkup = [[]];

    let [prettySocketType, plainSocketType] = getSocketTypeText(server.socketType);
    let [prettyAuthMethod, plainAuthMethod] = getAuthMethodText(server.authMethod);

    // Add the first SMTP server to this tr.
    let tr = createParentElement("tr", [
      createElement("td", account.key, {"rowspan": smtpMarkup.length}),
      // The server name can contain the email address, so it is private
      createElement("td", server.prettyName, {"rowspan": smtpMarkup.length,
                                              "class": CLASS_DATA_PRIVATE}),
      createElement("td", "(" + server.type + ") " + server.hostName + ":" +
                    server.port, {"rowspan": smtpMarkup.length}),
      createElement("td", prettySocketType,
                    {"rowspan": smtpMarkup.length}, plainSocketType),
      createElement("td", prettyAuthMethod,
                    {"rowspan": smtpMarkup.length}, plainAuthMethod),
    ].concat(smtpMarkup[0]));
    trAccounts.push(tr);
    // Add the remaining SMTP servers as separate trs
    for each (let [, tds] in Iterator(smtpMarkup.slice(1)))
      trAccounts.push(createParentElement("tr", tds));
  }

  appendChildren(document.getElementById("accounts-tbody"), trAccounts);
}

function populatePreferencesSection() {
  let modifiedPrefs = getModifiedPrefs();

  function comparePrefs(pref1, pref2) {
    if (pref1.name < pref2.name)
      return -1;
    if (pref1.name > pref2.name)
      return 1;
    return 0;
  }

  let sortedPrefs = modifiedPrefs.sort(comparePrefs);

  let trPrefs = [];
  sortedPrefs.forEach(function (pref) {
    let tdName = createElement("td", pref.name, {"class": "pref-name"});
    let tdValue = createElement("td", formatPrefValue(pref.value),
                                {"class": "pref-value"});
    let tr = createParentElement("tr", [tdName, tdValue]);
    trPrefs.push(tr);
  });

  appendChildren(document.getElementById("prefs-tbody"), trPrefs);
}

function formatPrefValue(prefValue) {
  // Some pref values are really long and don't have spaces.  This can cause
  // problems when copying and pasting into some WYSIWYG editors.  In general
  // the exact contents of really long pref values aren't particularly useful,
  // so we truncate them to some reasonable length.
  let maxPrefValueLen = 120;
  let text = "" + prefValue;
  if (text.length > maxPrefValueLen)
    text = text.substring(0, maxPrefValueLen) + ELLIPSIS;
  return text;
}

function getModifiedPrefs() {
  // We use the low-level prefs API to identify prefs that have been
  // modified, rather that Application.prefs.all since the latter is
  // much, much slower.  Application.prefs.all also gets slower each
  // time it's called.  See bug 517312.
  let prefNames = getWhitelistedPrefNames();
  let prefs = [Application.prefs.get(prefName)
                      for each (prefName in prefNames)
                          if (gPrefService.prefHasUserValue(prefName)
                            && !isBlacklisted(prefName))];
  return prefs;
}

function getWhitelistedPrefNames() {
  let results = [];
  PREFS_WHITELIST.forEach(function (prefStem) {
    let prefNames = gPrefService.getChildList(prefStem, {});
    results = results.concat(prefNames);
  });
  return results;
}

function isBlacklisted(prefName) {
  return PREFS_BLACKLIST.some(function (re) re.test(prefName));
}

function createParentElement(tagName, childElems) {
  let elem = document.createElement(tagName);
  appendChildren(elem, childElems);
  return elem;
}

function userDataHandler(aOp, aKey, aData, aSrc, aDest) {
  if (aOp == UserDataHandler.NODE_CLONED || aOp == UserDataHandler.NODE_IMPORTED)
    aDest.setUserData(aKey, aData, userDataHandler);
}

function onShowPrivateDataChange(aCheckbox) {
  document.getElementById("about-support-private").disabled = aCheckbox.checked;
}

function createElement(tagName, textContent, opt_attributes, opt_copyData) {
  if (opt_attributes == null)
    opt_attributes = [];
  let elem = document.createElement(tagName);
  elem.textContent = textContent;
  for each (let [key, value] in Iterator(opt_attributes))
    elem.setAttribute(key, "" + value);

  if (opt_copyData != null) {
    // Look for the (only) text node.
    let textNode = elem.firstChild;
    while (textNode && textNode.nodeType != Node.TEXT_NODE)
      textNode = textNode.nextSibling;
    // XXX warn here if textNode not found
    if (textNode)
      textNode.setUserData("copyData", opt_copyData, userDataHandler);
  }


  return elem;
}

function appendChildren(parentElem, childNodes) {
  for (let i = 0; i < childNodes.length; i++)
    parentElem.appendChild(childNodes[i]);
}

function copyPublicDataToClipboard() {
  // Get the HTML and text representations for the important part of the page.
  let contentsDiv = createCleanedUpContents(true);
  let dataHtml = contentsDiv.innerHTML;
  let dataText = createTextForElement(contentsDiv);

  // We can't use plain strings, we have to use nsSupportsString.
  let supportsStringClass = Cc["@mozilla.org/supports-string;1"];
  let ssHtml = supportsStringClass.createInstance(Ci.nsISupportsString);
  let ssText = supportsStringClass.createInstance(Ci.nsISupportsString);

  let transferable = Cc["@mozilla.org/widget/transferable;1"]
                       .createInstance(Ci.nsITransferable);

  // Add the HTML flavor.
  transferable.addDataFlavor("text/html");
  ssHtml.data = dataHtml;
  transferable.setTransferData("text/html", ssHtml, dataHtml.length * 2);

  // Add the plain text flavor.
  transferable.addDataFlavor("text/unicode");
  ssText.data = dataText;
  transferable.setTransferData("text/unicode", ssText, dataText.length * 2);

  // Store the data into the clipboard.
  let clipboard = Cc["@mozilla.org/widget/clipboard;1"]
                    .getService(Ci.nsIClipboard);
  clipboard.setData(transferable, null, clipboard.kGlobalClipboard);
}

function composeMessageWithPrivateData() {
  // Get the HTML and representation for the important part of the page.
  let contentsDiv = createCleanedUpContents(false);
  let dataHtml = contentsDiv.innerHTML;
  // The editor considers whitespace to be significant, so replace all
  // whitespace with a single space.
  dataHtml = dataHtml.replace(/\s+/g, " ");

  // Set up parameters and fields to use for the compose window.
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.type = Ci.nsIMsgCompType.New;
  params.format = Ci.nsIMsgCompFormat.HTML;

  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  fields.forcePlainText = false;
  fields.body = dataHtml;
  // In general we can have non-ASCII characters, and compose's charset
  // detection doesn't seem to work when the HTML part is pure ASCII but the
  // text isn't. So take the easy way out and force UTF-8.
  fields.characterSet = "UTF-8";
  fields.bodyIsAsciiOnly = false;
  params.composeFields = fields;

  // Our params are set up. Now open a compose window.
  let composeService = Cc["@mozilla.org/messengercompose;1"]
                         .getService(Ci.nsIMsgComposeService);
  composeService.OpenComposeWindowWithParams(null, params);
}

function createCleanedUpContents(aHidePrivateData) {
  // Get the important part of the page.
  let contentsDiv = document.getElementById("contents");
  // Deep-clone the entire div.
  let clonedDiv = contentsDiv.cloneNode(true);
  // Go in and replace text with the text we actually want to copy.
  // (this mutates the cloned node)
  cleanUpText(clonedDiv, aHidePrivateData);
  return clonedDiv;
}

function cleanUpText(aElem, aHidePrivateData) {
  let node = aElem.firstChild;
  while (node) {
    let className = ("className" in node && node.className) || "";
    // Delete uionly nodes.
    if (className.indexOf(CLASS_DATA_UIONLY) != -1) {
      aElem.removeChild(node);
    }
    // Replace private data with a blank string
    else if (aHidePrivateData && className.indexOf(CLASS_DATA_PRIVATE) != -1) {
      node.textContent = "";
    }
    else {
      // Replace localized text with non-localized text
      let copyData = node.getUserData("copyData");
      if (copyData != null)
        node.textContent = copyData;
    }

    if (node.nodeType == Node.ELEMENT_NODE)
      cleanUpText(node, aHidePrivateData);

    // Advance!
    node = node.nextSibling;
  }
}

// Return the plain text representation of an element.  Do a little bit
// of pretty-printing to make it human-readable.
function createTextForElement(elem) {
  // Generate the initial text.
  let textFragmentAccumulator = [];
  generateTextForElement(elem, "", textFragmentAccumulator);
  let text = textFragmentAccumulator.join("");

  // Trim extraneous whitespace before newlines, then squash extraneous
  // blank lines.
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n\n\n+/g, "\n\n");

  // Actual CR/LF pairs are needed for some Windows text editors.
  if ("@mozilla.org/windows-registry-key;1" in Cc)
    text = text.replace(/\n/g, "\r\n");

  return text;
}

function generateTextForElement(elem, indent, textFragmentAccumulator) {
  // Add a little extra spacing around most elements.
  if (elem.tagName != "td")
    textFragmentAccumulator.push("\n");

  // Generate the text representation for each child node.
  let node = elem.firstChild;
  while (node) {
    if (node.nodeType == Node.TEXT_NODE) {
      // Text belonging to this element uses its indentation level.
      generateTextForTextNode(node, indent, textFragmentAccumulator);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
      // Recurse on the child element with an extra level of indentation.
      generateTextForElement(node, indent + "  ", textFragmentAccumulator);
    }

    // Advance!
    node = node.nextSibling;
  }
}

function generateTextForTextNode(node, indent, textFragmentAccumulator) {
  // If the text node is the first of a run of text nodes, then start
  // a new line and add the initial indentation.
  let prevNode = node.previousSibling;
  if (!prevNode || prevNode.nodeType == Node.TEXT_NODE)
    textFragmentAccumulator.push("\n" + indent);

  // Trim the text node's text content and add proper indentation after
  // any internal line breaks.
  let text = node.textContent.trim().replace("\n", "\n" + indent, "g");
  textFragmentAccumulator.push(text);
}

function openProfileDirectory() {
  // Get the profile directory.
  let propertiesService = Cc["@mozilla.org/file/directory_service;1"]
                            .getService(Ci.nsIProperties);
  let currProfD = propertiesService.get("ProfD", Ci.nsIFile);
  let profileDir = currProfD.path;

  // Show the profile directory.
  let nsLocalFile = Components.Constructor("@mozilla.org/file/local;1",
                                           "nsILocalFile", "initWithPath");
  new nsLocalFile(profileDir).reveal();
}
