/* Because of the way JSONP works this codes assumes a global
 * variable named 'app' pointing to the BitcoinApp() instance!
 *
 * <script type="text/javascript">
 *     var app = new BitcoinApp();
 *     app.init();
 * </script>
 */

function BitcoinApp() {
	this.bitcoin = false;
	this.balance;
	this.connected = false;
	this.refreshTimeout = false;
	this.refreshInterval = 5000;

	this.generateConfirm = 120;
	this.dateFormat = "dd/mm/yyyy HH:MM";

	this.onGetBalance = function(balance) {
		$('#balance').text(balance.formatBTC());
		$('#currentAccount').text('"' + app.bitcoin.account + '"');
		app.balance = balance;
	}

	this.onGetAddress = function(address) {
		var addressField = $('#address');
		if(addressField.text() != address)
			$('#address').text(address);
	}

	this.onConnect = function(info) {
		if(info.version) {
			app.connected = true;

			app.refreshAll();

			$('#section_Settings').next().slideUp('fast');
			$('#address').slideDown('fast');
			$('#section_Accounts').show();
			$('#section_SendBTC').show();
			$('#section_TX').show().next().show();
			$('#serverInfo').show();

			var connInfo = '<label>Connected to:</label> ' + app.bitcoin.RPCHost + ':' + app.bitcoin.RPCPort + '<br/><label>Account:</label> "' + app.bitcoin.account + '"';

			$('#connectionInfo').html(connInfo).show();
		}
	}

	this.setTitle = function(title) {
		$('#title').text(title);
		document.title = title;
	}

	this.onDisconnect = function() {
		app.connected = false;
		app.setTitle("Bitcoin (not connected)");

		$('#address').slideUp('fast');
		$('#serverInfo').hide();
		$('#serverInfo table').children().remove();
		$('#section_SendBTC').hide().next().hide();
		$('#section_TX').hide().next().hide();
		$('#section_Accounts').hide().next().hide();
		$('#section_Settings').next().show();
		$('#connectionInfo').html('').hide();

		app.clearAccounts();
		app.clearAccountInfo();
	}

	this.clearAccountInfo = function() {
		$('#currentAccount').text('');
		app.balance = false;
		app.clearTransactions();
	}

	this.onGetInfo = function(info) {
		var sNetwork = "Bitcoin";
		if(info.testnet) {
			sNetwork = "Testnet";
		}

		app.setTitle(sNetwork + " on " + app.bitcoin.RPCHost);

		var serverInfo = $('#serverInfo table');

		serverInfo.children().remove();

		for (var key in info) {
			serverInfo.append('<tr><td>' + key.capitalize() + '</td><td class="right">' + info[key] + '</td></tr>');
		}
		$('#serverInfo tr:odd').addClass('odd');
	}

	this.onSendBTC = function(result, error) {
		if(error != null) {
			app.error(error.message);
			return;
		}
		var obj;
		obj	= setFormValue($('form#sendBTC'), "address", "");
		hideValidation(obj);

		obj = setFormValue($('form#sendBTC'), "amount", "");
		hideValidation(obj);

		app.notify("Bitcoins sent");
		app.refreshAll();
	}

	this.onValidateAddressField = function(result) {
		var field = $('form#sendBTC input[name="address"]')

		if(result.isvalid && field.val() == result.address)
			showValidation(field, true);
		else
			showValidation(field, false);
	}

	this.onListAccounts = function(accounts) {
		for (var account in accounts) {
			var balance = accounts[account];

			var row = $('#accountList tbody').children('tr[name="' + account + '"]');

			if (row.length == 0) {
				row = $('<tr></tr>');

				var html ='<td class="left">"' + account + '"</td>';
					html += '<td></td>';

				row.append(html);

				row.attr('name', account);
				row.click( function() {
							app.selectAccount($(this).attr('name'));
						})

				$('#accountList tbody').append(row);
			}

			app.updateAccountRow(row, balance);
		}
	}

	this.updateAccountRow = function(row, balance) {
		var balanceClass = "";
		if(balance != 0)
			balanceClass = (balance<0?'debit':'credit');

		row.children('td:last-child').removeClass().addClass("right").addClass(balanceClass).text(balance.formatBTC());
	}

	this.onListTransactions = function(transactions) {
		var start = new Date().getTime();

		for (var key in transactions)
			if (transactions[key].time == undefined)
				transactions[key].time = 0;

		transactions.sort(sortTransactions);

		var txlistContainer = $('#txlist');

		if(txlistContainer.children('tbody').length == 0)
			txlistContainer.append('<tbody />');

		var txlist = txlistContainer.children('tbody');

		for (var key in transactions)
			app.processTransaction(txlist, transactions[key]);

		$('#txlist tbody tr:not(.txinfo):odd').addClass('odd').next('.txinfo').addClass('odd');
		$('#txlist tbody tr:not(.txinfo):even').removeClass('odd').next('.txinfo').removeClass('odd');

		var end = new Date().getTime();
		var time = end - start;
		var newInterval = time * 10;

		/* adjust refresh interval within 1..10 seconds depending
		 * processing time of txlist
		 */

		app.refreshInterval = Math.min(Math.max(newInterval, 1000), 10000);
	}

	this.clearAccounts = function() {
		$('#accountList tbody').children().remove();
	}

	this.clearTransactions = function() {
		$('#txlist tbody').children().remove();
	}

	this.processTransaction = function(txlist, tx) {
		if (tx.txid == undefined)
			tx.id = (tx.time + tx.amount + tx.otheraccount).replace(/ /g,'');
		else
			tx.id = tx.txid;

		tx.id += tx.category;

		var txrow = $(document.getElementById(tx.id));

		if (txrow.length == 0) {
			txrow = $('<tr id="' + tx.id + '"></tr>');
			txlist.prepend(txrow);
			var txdiv = $('<tr colspan="4" class="txinfo"><td colspan="4"><div style="display: none"></div></td></tr>');
			txrow.after(txdiv);

			txrow.click( function() {
					$(this).next('tr.txinfo').children('td').children('div').slideToggle('fast');
				});
		}

		var checksum = tx.id + tx.confirmations + tx.time;

		/* Only update TX if it differs from current one */
		if(txrow.attr('checksum') != checksum) {
			txrow.attr('checksum', checksum);
			txrow.html(this.txRowHTML(tx));

			txrow.next('tr.txinfo').children('td').children('div').html(this.txInfoHTML(tx));

			if (tx.confirmations == 0 || (tx.category == "generate" && tx.confirmations < this.generateConfirm))
				txrow.addClass("unconfirmed");
			else
				txrow.removeClass("unconfirmed");
		}
	}

	this.txInfoHTML = function(tx) {
		var html = "";

		if(tx.category != undefined) html += "<label>Category:</label> " + tx.category.capitalize() + "<br/>";
		if(tx.address != undefined) html += "<label>Address:</label> " + tx.address + "<br/>";
		if(tx.otheraccount != undefined) html += "<label>Other Account:</label> " + tx.otheraccount + "<br/>";
		if(tx.confirmations != undefined) html += "<label>Confirmations:</label> " + tx.confirmations + "<br/>";
		if(tx.fee != undefined) html += "<label>Fee:</label> " + tx.fee.formatBTC() + "<br/>";
		if(tx.comment != "" && tx.comment != undefined) html += "<label>Comment:</label> " + tx.comment + "<br/>";

		return html;
	}

	this.txRowHTML = function(tx) {
		var confirmations = tx.confirmations<10?tx.confirmations:'&#x2713;';

		if (tx.category == "generate")
			confirmations = tx.confirmations<this.generateConfirm?'&#x2717':'&#x2713';

		var timestamp = new Date();
		timestamp.setTime (tx.time * 1000);

		var info = tx.category.capitalize();

		if (tx.category == 'send' || tx.category == 'receive')
			info = tx.address;

		if (tx.category == 'move')
			info = '"' + tx.otheraccount + '"';

		var amountClass = (tx.amount<0?'debit':'credit');

		var html = '<td class="center">' + confirmations + '</td>';
		html += '<td>' + timestamp.format(this.dateFormat) + '</td>';
		html += '<td class="' + ((tx.address || tx.otheraccount)?amountClass + ' ':null) + 'info">' + info + '</td>';
		html += '<td class="' + amountClass + ' right">' + tx.amount.formatBTC(true) + '</td>';

		var txitem = $(html);

		return txitem;
	}

	this.refreshAll = function() {
		clearTimeout(this.refreshTimeout);

		if(!this.connected) {
			return;
		}

		this.refreshServerInfo();
		this.refreshBalance();
		this.refreshTransactions();
		this.refreshAddress();
		this.refreshAccounts();

		this.refreshTimeout = setTimeout("app.refreshAll();", this.refreshInterval);
	}

	this.refreshServerInfo = function() {
		this.bitcoin.getInfo(this.onGetInfo);
	}

	this.refreshAccounts = function() {
		this.bitcoin.listAccounts(this.onListAccounts);
	}

	this.refreshTransactions = function() {
		this.bitcoin.listTransactions(this.onListTransactions);
	}

	this.refreshBalance = function() {
		this.bitcoin.getBalance(this.onGetBalance);
	}

	this.refreshAddress = function() {
		this.bitcoin.getAddress(this.onGetAddress);
	}

	this.selectAccount = function(account) {
		this.clearAccountInfo();
		this.bitcoin.selectAccount(account);
		if (this.connected)
			this.refreshAll();
	}

	this.connect = function(host, port, user, pass, account) {
		this.onDisconnect();
		this.notify("Connecting");
		this.bitcoin = new Bitcoin(host, port, user, pass);
		this.bitcoin.init();
		this.selectAccount(account);
		this.bitcoin.getInfo(this.onConnect);
	}

	this.error = function(msg) {
		$(window).humanMsg(msg);
	}

	this.notify = function(msg) {
		$(window).humanMsg(msg);
	}

	this.sendBTC = function(address, amount) {
		if(!this.connected) {
			return this.error("Not connected!");
		}

		if(address === "") {
			return this.error("Invalid bitcoin address");
		}

		amount = Math.round(amount*100)/100;
		var confString = "Send " + amount.formatBTC() + " to " + address + "?";

		if(confirm(confString)) {
			app.bitcoin.sendBTC(this.onSendBTC, '"' + address + '"', amount);
		}
	}

	this.addPrototypes = function() {
		String.prototype.capitalize = function() {
			    return this.charAt(0).toUpperCase() + this.slice(1);
		}

		Number.prototype.formatBTC = function(addSign) {
			var nf = new NumberFormat(this);
			nf.setPlaces(2);
			nf.setCurrency(true);
			nf.setCurrencyValue(" BTC");
			nf.setCurrencyPosition(nf.RIGHT_OUTSIDE);

			var s = nf.toFormatted();

			if(addSign && this > 0)
				s = "+" + s;

			return s;
		}
	}

	this.init = function() {
		this.addPrototypes();

		if(!this.connected) {
			$('#address').hide();

			$.getJSON('settings.json', function(data) {
						if(data) {
							var form = $('form#settingsServer');
							setFormValue(form, "host", data.host);
							setFormValue(form, "port", data.port);
							setFormValue(form, "user", data.user);
							setFormValue(form, "pass", data.pass);
							setFormValue(form, "account", data.account);
						}
					});
			this.onDisconnect();
		}

		$('#disconnectButton').click( function() {
					app.onDisconnect();
					return false;
				});

		$('form#settingsServer').submit( function() {
					var host = getFormValue(this, "host");
					var port = getFormValue(this, "port");
					var user = getFormValue(this, "user");
					var pass = getFormValue(this, "pass");
					var account = getFormValue(this, "account");
					app.connect(host, port, user, pass, account);
					return false;
				});

		$('form#sendBTC input[name="address"]').change( function() {
					if($(this).val() === "") {
						hideValidation(this);
						return;
					}

					var address = $(this).val();

					app.bitcoin.validateAddress(app.onValidateAddressField, address);
				});

		$('form#sendBTC input[name="amount"]').change( function() {
					if($(this).val() === "") {
						hideValidation(this);
						return;
					}

					var amount = $(this).val();

					if(amount > 0 && amount <= app.balance)
						showValidation(this, true);
					else
						showValidation(this, false);
				});

		$('form#sendBTC').submit( function() {
					var address = getFormValue(this, "address");
					var amount = getFormValue(this, "amount");

					app.sendBTC(address, amount);
					return false;
				});
	}
}
