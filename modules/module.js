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

"use strict";

var EXPORTED_SYMBOLS = ["AboutSupport"];

// Platform-specific includes
if ("@mozilla.org/windows-registry-key;1" in Components.classes)
  Components.utils.import("resource://about-support/win32.js");
else if ("nsILocalFileMac" in Components.interfaces)
  Components.utils.import("resource://about-support/mac.js");
else
  Components.utils.import("resource://about-support/unix.js");

Components.utils.import("resource:///modules/iteratorUtils.jsm");

var AboutSupport = {
  __proto__: AboutSupportPlatform,

  /**
   * Gets details about SMTP servers for a given nsIMsgAccount.
   *
   * @returns A list of records, each record containing the name and other details
   *          about one SMTP server.
   */
  _getSMTPDetails: function AboutSupport__getSMTPDetails(aAccount) {
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
  },

  /**
   * Returns account details as a dictionary, keyed by the account ID.
   */
  getAccountDetails: function AboutSupport_getAccountDetails() {
    let accountDetails = {};
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    let accounts = accountManager.accounts;

    for each (let account in fixIterator(accounts, Ci.nsIMsgAccount)) {
      let server = account.incomingServer;
      accountDetails[account.key] = {
        name: server.prettyName,
        type: server.type,
        hostName: server.hostName,
        port: server.port,
        socketType: server.socketType,
        authMethod: server.authMethod,
        smtpServers: this._getSMTPDetails(account)
      };
    }

    return accountDetails;
  }
};
