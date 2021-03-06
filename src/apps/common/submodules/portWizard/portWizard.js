define(function(require) {
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		toastr = require('toastr');

	var portWizard = {

		// Defines API requests not included in the SDK
		requests: {
		},

		// Define the events available for other apps
		subscribe: {
			'common.portWizard.render': 'portWizardRenderPortInfo'
		},

		appFlags: {
			attachments: {
				mimeTypes: [
					'application/pdf'
				],
				maxSize: 8
			}
		},

		/**************************************************
		 *               Templates rendering              *
		 **************************************************/

		portWizardRenderPortInfo: function(args) {
			var self = this,
				container = args.container,
				initTemplate = function initTemplate() {
					var template = $(self.getTemplate({
						name: 'portInfo',
						data: {
							request: args.data.request
						},
						submodule: 'portWizard'
					}));

					if (args.data.request.hasOwnProperty('uploads') && args.data.request.uploads.hasOwnProperty('bill.pdf')) {
						var billUploadTemplate = $(self.getTemplate({
								name: 'portInfo-billUpload',
								submodule: 'portWizard'
							})),
							actionsTemplate = $(self.getTemplate({
								name: 'portInfo-actions',
								submodule: 'portWizard'
							}));

						billUploadTemplate
							.find('#bill_input')
								.fileUpload({
									btnClass: 'monster-button-primary monster-button-small',
									btnText: self.i18n.active().portWizard.fileUpload.button,
									inputOnly: true,
									inputPlaceholder: self.i18n.active().portWizard.fileUpload.placeholder,
									mimeTypes: self.appFlags.attachments.mimeTypes,
									maxSize: self.appFlags.attachments.maxSize,
									filesList: [ 'bill.pdf' ],
									success: function(results) {
										self.portWizardRequestUpdateAttachment({
											data: {
												accountId: args.data.accountId,
												portRequestId: args.data.request.id,
												documentName: 'bill.pdf',
												data: results[0].file
											}
										});
									},
									error: function(errorsList) {
										self.portWizardFileUploadErrorsHandler(errorsList);
									}
								});

						template
							.find('.bill-upload-wrapper')
								.append(billUploadTemplate);

						template
							.find('.actions')
								.append(actionsTemplate);

						template
							.find('.bill-upload')
								.show();
					}

					self.portWizardBindPortInfoEvents(template, args);

					return template;
				};

			/*
				If this common control is loaded in the global
				app container, we need to remove custom classes
				so that there is no conflict with the CSS rules
			 */
			if (container.hasClass('app-content-wrapper')) {
				container.prop('class', 'app-content-wrapper');
			}

			$.extend(true, args, {
				data: {
					attachments: {},
					request: {
						ui_flags: {},
						numbers: {}
					}
				}
			});

			monster.ui.insertTemplate(container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate(), function() {
					container
						.find('#name')
							.focus();
				});
			});
		},

		portWizardRenderAccountVerification: function(args) {
			var self = this,
				container = args.container,
				initTemplate = function initTemplate(billFileData) {
					var template = $(self.getTemplate({
						name: 'accountVerification',
						data: {
							request: args.data.request
						},
						submodule: 'portWizard'
					}));

					monster.ui.renderPDF(billFileData, template.find('.pdf-container'));

					self.portWizardBindAccountVerificationEvents(template, args);

					return template;
				},
				afterInsertTemplate = function() {
					container
						.find('#carrier')
							.focus();
				};

			monster.ui.insertTemplate(container, function(insertTemplateCallback) {
				if (args.data.request.hasOwnProperty('uploads') && args.data.request.uploads.hasOwnProperty('bill.pdf')) {
					self.portWizardRequestGetAttahcment({
						data: {
							accountId: args.data.accountId,
							portRequestId: args.data.request.id,
							documentName: 'bill.pdf'
						},
						success: function(billFileData) {
							args.data.attachments.bill = {
								file: billFileData
							};

							insertTemplateCallback(initTemplate(billFileData), afterInsertTemplate);
						}
					});
				} else {
					insertTemplateCallback(initTemplate(args.data.attachments.bill.file), afterInsertTemplate);
				}
			});
		},

		portWizardRenderAddNumbers: function(args) {
			var self = this,
				container = args.container,
				template = $(self.getTemplate({
					name: 'addNumbers',
					submodule: 'portWizard'
				}));

			monster.ui.renderPDF(args.data.attachments.bill.file, template.find('.pdf-container'));

			container
				.fadeOut(function() {
					container
						.empty()
						.append(template)
						.fadeIn(function() {
							container
								.find('#numbers')
									.focus();
						});

					self.portWizardRenderAddNumbersList(args);
					self.portWizardRenderAddNumbersPortion(args);

					if (!args.data.request.numbers.hasOwnProperty(args.data.request.bill.btn) & !_.isEmpty(args.data.request.numbers)) {
						self.portWizardRenderAddNumbersActions(args);
					}

					self.portWizardBindAddNumbersEvents(args);
				});
		},

		portWizardRenderAddNumbersList: function(args) {
			var self = this,
				container = args.container,
				dataToTemplate = $.extend(true, args.data, {
					request: {
						extra: {
							numbers_count: _.keys(args.data.request.numbers).length
						}
					}
				}),
				template = $(self.getTemplate({
					name: 'addNumbers-list',
					data: dataToTemplate,
					submodule: 'portWizard'
				})),
				$listWrapper = container.find('.list-wrapper');

			if ($listWrapper.is(':empty')) {
				$listWrapper
					.hide()
					.append(template)
					.fadeIn();
			} else {
				$listWrapper
					.empty()
					.append(template);
			}

			if (_.isEmpty(args.data.request.numbers)) {
				delete args.data.request.ui_flags.portion;

				container
					.find('.success-wrapper')
						.fadeOut(function() {
							$(this)
								.empty();
						});
			}

			self.portWizardBindAddNumbersListEvents(args);
		},

		portWizardRenderAddNumbersPortion: function(args) {
			var self = this,
				request = args.data.request,
				container = args.container,
				template = $(self.getTemplate({
					name: 'addNumbers-portion',
					submodule: 'portWizard'
				}));

			if (request.numbers.hasOwnProperty(request.bill.btn)) {
				template
					.find('.portion-item[data-portion="' + request.ui_flags.portion + '"]')
						.addClass('active');

				if (request.ui_flags.portion === 'full') {
					self.portWizardRenderAddNumbersActions(args);
				} else if (request.ui_flags.portion === 'partial') {
					self.portWizardRenderAddNumbersBtn(args);
					self.portWizardRenderAddNumbersActions(args);
				}

				container
					.find('.portion-wrapper')
						.fadeOut(function() {
							$(this)
								.empty()
								.append(template)
								.fadeIn();

							self.portWizardBindAddNumbersPortionEvents(args);
						});
			}
		},

		portWizardRenderAddNumbersBtn: function(args) {
			var self = this,
				container = args.container,
				dataToTemplate = {
					request: args.data.request
				},
				template = $(self.getTemplate({
					name: 'addNumbers-btn',
					data: dataToTemplate,
					submodule: 'portWizard'
				}));

			container
				.find('.btn-wrapper')
					.empty()
					.append(template)
					.slideDown();
		},

		portWizardRenderAddNumbersActions: function(args) {
			var self = this,
				container = args.container,
				formType = self.portWizardGetFormType(args.data.request),
				dataToTemplate = {
					request: args.data.request,
					eSignEnabled: false,
					buttons: {
						manual: self.i18n.active().portWizard.addNumbers.buttons.next.manual[formType],
						electronic: self.i18n.active().portWizard.addNumbers.buttons.next.eSign[formType]
					}
				},
				template = $(self.getTemplate({
					name: 'addNumbers-actions',
					data: dataToTemplate,
					submodule: 'portWizard'
				})),
				$successWrapper = container.find('.success-wrapper');

			if ($successWrapper.is(':empty')) {
				$successWrapper
					.hide()
					.append(template)
					.fadeIn();

				self.portWizardBindAddNumbersActionsEvents(args);
			}
		},

		portWizardRenderUploadForm: function(args) {
			var self = this,
				data = args.data,
				request = data.request,
				formType = self.portWizardGetFormType(request),
				initTemplate = function initTemplate() {
					var dataToTemplate = {
							type: self.i18n.active().portWizard.formTypes[formType],
							formLink: monster.config.whitelabel.port[formType]
						},
						template = $(self.getTemplate({
							name: 'uploadForm',
							data: dataToTemplate,
							submodule: 'portWizard'
						})),
						actionsTemplate;

					if (request.hasOwnProperty('uploads') && request.uploads.hasOwnProperty('form.pdf')) {
						actionsTemplate = $(self.getTemplate({
							name: 'uploadForm-actions',
							submodule: 'portWizard'
						}));

						template
							.find('.actions')
								.append(actionsTemplate);
					}

					self.portWizardBindUploadFormEvents(template, args);

					return template;
				};

			monster.ui.insertTemplate(args.container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate());
			});
		},

		portWizardRenderSignForm: function(args) {
			var self = this,
				initTemplate = function initTemplate() {
					var formType = self.portWizardGetFormType(args.data.request),
						dataToTemplate = {
							type: self.i18n.active().portWizard.formTypes[formType]
						},
						template = $(self.getTemplate({
							name: 'signForm',
							data: dataToTemplate,
							submodule: 'portWizard'
						}));

					self.portWizardBindSignFormEvents(template, args);

					return template;
				};

			monster.ui.insertTemplate(args.container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate());
			});
		},

		portWizardRenderPortNotify: function(args) {
			var self = this,
				container = args.container,
				initTemplate = function initTemplate() {
					var template = $(self.getTemplate({
						name: 'portNotify',
						data: {
							request: args.data.request
						},
						submodule: 'portWizard'
					}));

					self.portWizardBindPortNotifyEvents(template, args);

					return template;
				};

			monster.ui.insertTemplate(container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate(), function() {
					container
						.find('#email')
							.focus();
				});
			});
		},

		portWizardRenderSubmitPort: function(args) {
			var self = this,
				initTemplate = function initTemplate() {
					var dataToTemplate = {
							request: args.data.request,
							today: new Date()
						},
						template = $(self.getTemplate({
							name: 'portSubmit',
							data: dataToTemplate,
							submodule: 'portWizard'
						}));

					self.portWizardBindPortSubmitEvents(template, args);

					return template;
				};

			monster.ui.insertTemplate(args.container, function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate());
			});
		},

		/**************************************************
		 *                 Events bindings                *
		 **************************************************/

		portWizardBindPortInfoEvents: function(template, args) {
			var self = this,
				billFileData;

			template
				.on('change', '.numbers-type', function(event) {
					event.preventDefault();

					var billUploadTemplate;

					if (template.find('.bill-upload-wrapper').is(':empty')) {
						billUploadTemplate = $(self.getTemplate({
							name: 'portInfo-billUpload',
							submodule: 'portWizard'
						})).css('display', 'none');

						billUploadTemplate
							.find('#bill_input')
								.fileUpload({
									btnClass: 'monster-button-primary monster-button-small',
									btnText: self.i18n.active().portWizard.fileUpload.button,
									inputOnly: true,
									inputPlaceholder: self.i18n.active().portWizard.fileUpload.placeholder,
									mimeTypes: self.appFlags.attachments.mimeTypes,
									maxSize: self.appFlags.attachments.maxSize,
									success: function(results) {
										var actionsTemplate = $(self.getTemplate({
											name: 'portInfo-actions',
											submodule: 'portWizard'
										})).css('display', 'none');

										if (template.find('.portInfo-success').length < 1) {
											billFileData = results[0];

											template
												.find('.actions')
													.prepend(actionsTemplate);

											template
												.find('.portInfo-success')
													.fadeIn();
										}
									},
									error: function(errorsList) {
										self.portWizardFileUploadErrorsHandler(errorsList);
									}
								});

						template
							.find('.bill-upload-wrapper')
								.append(billUploadTemplate);

						template
							.find('.bill-upload')
								.fadeIn();
					}
				});

			template
				.on('click', '.portInfo-success', function(event) {
					event.preventDefault();

					var $form = template.find('#form_port_info'),
						formData = monster.ui.getFormData('form_port_info');

					monster.ui.validate($form, {
						rules: {
							name: {
								required: true,
								minlength: 1,
								maxlength: 128
							},
							'type': {
								required: true
							}
						}
					});

					if (monster.ui.valid($form)) {
						$.extend(true, args.data, {
							request: formData,
							attachments: {
								bill: billFileData
							}
						});

						self.portWizardRenderAccountVerification(args);
					}
				});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindAccountVerificationEvents: function(template, args) {
			var self = this,
				formValidationRules = {
					'bill.name': {
						minlength: 1,
						maxlength: 128
					},
					'bill.street_address': {
						minlength: 1,
						maxlength: 128
					},
					'bill.locality': {
						minlength: 1,
						maxlength: 128
					},
					'bill.region': {
						minlength: 2,
						maxlength: 2
					},
					'bill.postal_code': {
						digits: true,
						minlength: 5,
						maxlength: 5
					},
					'bill.account_number': {
						maxlength: 128
					},
					'bill.pin': {
						maxlength: 6
					},
					'bill.btn': {
						maxlength: 20
					}
				};

			template
				.find('.next')
					.on('click', function(event) {
						event.preventDefault();

						var action = $(this).data('action'),
							$form = template.find('#form_account_verification'),
							formData = monster.ui.getFormData('form_account_verification'),
							btn = formData.bill.btn ? monster.util.unformatPhoneNumber(monster.util.formatPhoneNumber(formData.bill.btn), 'keepPlus') : '';

						if (action === 'next') {
							$.extend(true, formValidationRules, {
								'ui_flags.validation': {
									required: true
								}
							});
						}

						monster.ui.validate($form, {
							rules: formValidationRules
						});

						if (monster.ui.valid($form)) {
							$.extend(true, args.data.request, {
								ui_flags: formData.ui_flags,
								bill: $.extend(true, formData.bill, {
									btn: btn
								})
							});

							if (action === 'save') {
								self.portWizardHelperSavePort($.extend(true, args, {
									success: args.globalCallback
								}));
							} else if (action === 'next') {
								self.portWizardRenderAddNumbers(args);
							}
						}
					});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindAddNumbersEvents: function(args) {
			var self = this,
				container = args.container;

			container
				.find('.collapse')
					.on('click', function(event) {
						event.preventDefault();

						var $this = $(this);

						$this
							.fadeOut(function() {
								container
									.find('.accordion')
										.slideDown();
							});
					});

			container
				.find('.add-numbers')
					.on('click', function(event) {
						event.preventDefault();

						var $form = container.find('#form_add_numbers'),
							formData = monster.ui.getFormData('form_add_numbers'),
							newNumbers = {},
							phoneNumber,
							errors = false;

						monster.ui.validate($form, {
							rules: {
								numbers: {
									required: true
								}
							}
						});

						if (monster.ui.valid($form)) {
							formData.numbers = formData.numbers.replace(/[\n]/g, ' ');
							formData.numbers = formData.numbers.replace(/[-().]/g, '').split(' ');

							_.each(formData.numbers, function(number) {
								phoneNumber = number.match(/^\+(.*)$/);

								if (phoneNumber && phoneNumber[1]) {
									newNumbers[number] = {};
								} else {
									errors = true;
								}
							});

							$.extend(true, args, {
								data: {
									request: {
										numbers: newNumbers
									}
								}
							});

							$form
								.find('textarea')
									.val('');

							if (errors) {
								toastr.warning(self.i18n.active().portWizard.toastr.warning.invalidNumbers);
							} else {
								container
									.find('.accordion')
										.slideUp(function() {
											container
												.find('.collapse')
													.fadeIn();
										});
							}

							self.portWizardRenderAddNumbersList(args);
							self.portWizardRenderAddNumbersPortion(args);

							if (args.data.request.numbers.hasOwnProperty(args.data.request.bill.btn)) {
								container
									.find('.success-wrapper')
										.fadeOut(function() {
											$(this)
												.empty();
										});
							} else {
								self.portWizardRenderAddNumbersActions(args);
							}
						}
					});

			container
				.find('.save')
					.on('click', function(event) {
						event.preventDefault();

						var formData = monster.ui.getFormData('form_new_btn'),
							portion = container.find('.portion-item.active').data('portion');

						$.extend(true, args, {
							data: {
								request: {
									ui_flags: {
										portion: portion
									},
									bill: {
										new_btn: formData.new_btn
									}
								}
							}
						});

						self.portWizardHelperSavePort($.extend(true, args, {
							success: args.globalCallback
						}));
					});

			container
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindAddNumbersListEvents: function(args) {
			var self = this,
				container = args.container;

			container
				.find('.remove-number')
					.on('click', function(event) {
						event.preventDefault();

						var $this = $(this),
							$item = $this.parents('.item'),
							number = $item.data('number');

						if (args.data.request.bill.btn === number) {
							container
								.find('.portion-wrapper')
									.slideUp(function() {
										$(this)
											.empty();
									});

							container
								.find('.btn-wrapper')
									.slideUp(function() {
										$(this)
											.empty();
									});

							self.portWizardRenderAddNumbersActions(args);
						}

						delete args.data.request.numbers[number];

						self.portWizardRenderAddNumbersList(args);
					});
		},

		portWizardBindAddNumbersPortionEvents: function(args) {
			var self = this,
				container = args.container;

			container
				.find('.portion-item')
					.on('click', function(event) {
						event.preventDefault();

						var $this = $(this),
							portion = $this.data('portion');

						if (!$this.hasClass('active')) {
							$this
								.siblings()
									.removeClass('active');

							$this
								.addClass('active');

							if (portion === 'full') {
								container
									.find('.btn-wrapper')
										.slideUp(function() {
											$(this)
												.empty();
										});
							} else {
								self.portWizardRenderAddNumbersBtn(args);
							}

							self.portWizardRenderAddNumbersActions(args);
						}
					});
		},

		portWizardBindAddNumbersActionsEvents: function(args) {
			var self = this,
				container = args.container;

			container
				.find('.next')
					.on('click', function(event) {
						event.preventDefault();

						var sign = $(this).data('sign'),
							$form = container.find('#form_new_btn'),
							formData = monster.ui.getFormData('form_new_btn'),
							portion = container.find('.portion-item.active').data('portion');

						monster.ui.validate($form, {
							rules: {
								new_btn: {
									required: true
								}
							}
						});

						if (monster.ui.valid($form)) {
							$.extend(true, args, {
								data: {
									request: {
										ui_flags: {
											portion: portion
										},
										bill: {
											new_btn: formData.new_btn
										}
									}
								}
							});

							if (sign === 'manual') {
								self.portWizardRenderUploadForm(args);
							} else {
								self.portWizardRenderSignForm(args);
							}
						}
					});
		},

		portWizardBindUploadFormEvents: function(template, args) {
			var self = this,
				fileUploadOptions = (function(data) {
					var request = data.request,
						options = {
							btnClass: 'monster-button-primary monster-button-small',
							btnText: self.i18n.active().portWizard.fileUpload.button,
							inputOnly: true,
							inputPlaceholder: self.i18n.active().portWizard.fileUpload.placeholder,
							mimeTypes: self.appFlags.attachments.mimeTypes,
							maxSize: self.appFlags.attachments.maxSize,
							success: function(results) {
								if (request.hasOwnProperty('id')) {
									if (request.hasOwnProperty('uploads') && request.uploads.hasOwnProperty('form.pdf')) {
										self.portWizardRequestUpdateAttachment({
											data: {
												accountId: data.accountId,
												portRequestId: request.id,
												documentName: 'form.pdf',
												data: results[0].file
											}
										});
									} else {
										self.portWizardRequestCreateAttachment({
											data: {
												accountId: data.accountId,
												portRequestId: request.id,
												documentName: 'form.pdf',
												data: results[0].file
											},
											success: function() {
												if (template.find('.uploadForm-success').length < 1) {
													actionsTemplate = $(self.getTemplate({
														name: 'uploadForm-actions',
														submodule: 'portWizard'
													})).css('display', 'none');

													template
														.find('.actions')
															.append(actionsTemplate);

													template
														.find('.uploadForm-success')
															.fadeIn();
												}
											}
										});
									}
								} else {
									$.extend(true, args.data, {
										attachments: {
											form: results[0]
										}
									});

									if (template.find('.uploadForm-success').length < 1) {
										actionsTemplate = $(self.getTemplate({
											name: 'uploadForm-actions',
											submodule: 'portWizard'
										})).css('display', 'none');

										template
											.find('.actions')
												.append(actionsTemplate);

										template
											.find('.uploadForm-success')
												.fadeIn();
									}
								}
							},
							error: function(errorsList) {
								self.portWizardFileUploadErrorsHandler(errorsList);
							}
						},
						actionsTemplate;

					if (args.data.request.hasOwnProperty('uploads') && args.data.request.uploads.hasOwnProperty('form.pdf')) {
						options.filesList = [ 'form.pdf' ];
					}

					return options;
				})(args.data);

			template
				.find('#form_input')
					.fileUpload(fileUploadOptions);

			template
				.find('.save')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperSavePort($.extend(true, args, {
							success: args.globalCallback
						}));
					});

			template
				.on('click', '.uploadForm-success', function(event) {
					event.preventDefault();

					self.portWizardRenderPortNotify(args);
				});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindSignFormEvents: function(template, args) {
			var self = this;

			template
				.find('.success')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardRenderPortNotify(args);
					});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindPortNotifyEvents: function(template, args) {
			var self = this,
				minDate = monster.util.getBusinessDate(4),
				defaultDate = args.data.request.hasOwnProperty('transfer_date') ? monster.util.gregorianToDate(args.data.request.transfer_date) : minDate;

			monster.ui.datepicker(template.find('#transfer_date'), {
				minDate: minDate,
				beforeShowDay: $.datepicker.noWeekends
			}).datepicker('setDate', defaultDate);

			template
				.find('.next')
					.on('click', function(event) {
						event.preventDefault();

						var action = $(this).data('action'),
							formData = monster.ui.getFormData('form_notify');

						$.extend(true, args.data.request, formData, {
							transfer_date: monster.util.dateToGregorian(new Date(formData.transfer_date))
						});

						if (action === 'save') {
							self.portWizardHelperSavePort($.extend(true, args, {
								success: args.globalCallback
							}));
						} else if (action === 'next') {
							self.portWizardRenderSubmitPort(args);
						}
					});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		portWizardBindPortSubmitEvents: function(template, args) {
			var self = this;

			template
				.find('.conditions')
					.on('change', function(event) {
						event.preventDefault();

						var formData = monster.ui.getFormData('form_conditions'),
							disabled = formData.conditions.indexOf(false) > -1;

						template
							.find('.success')
								.prop('disabled', disabled);
					});

			template
				.find('.success')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperSavePort($.extend(true, args, {
							success: function(requestId) {
								self.portWizardRequestUpdateState({
									data: {
										accountId: args.data.accountId,
										portRequestId: requestId,
										state: 'submitted'
									},
									success: function() {
										args.globalCallback();
									}
								});
							}
						}));
					});

			template
				.find('.cancel')
					.on('click', function(event) {
						event.preventDefault();

						self.portWizardHelperCancelPort(args);
					});
		},

		/**************************************************
		 *                   UI helpers                   *
		 **************************************************/

		portWizardUILoading: function(args, loadingData) {
			var self = this,
				container = args.container,
				callback = _.isFunction(loadingData) ? loadingData : loadingData.callback,
				dataToTemplate = _.isFunction(loadingData) ? {} : loadingData,
				template = self.getTemplate({
					name: 'loading',
					data: dataToTemplate,
					submodule: 'portWizard'
				});

			if (container.is(':empty')) {
				container
					.hide(0, function() {
						$(this)
							.append(template)
							.fadeIn();
					});
			} else {
				container
					.fadeOut(function() {
						$(this)
							.empty()
							.append(template)
							.fadeIn();
					});
			}

			callback();
		},

		/**************************************************
		 *              Data handling helpers             *
		 **************************************************/

		portWizardGetFormType: function(portData) {
			return portData.ui_flags.type === 'local' ? 'loa' : 'resporg';
		},

		portWizardFileUploadErrorsHandler: function(errorsList) {
			var self = this,
				mimeTypes = self.appFlags.attachments.mimeTypes,
				maxSize = self.appFlags.attachments.maxSize,
				fileTypes;

			_.each(errorsList, function(files, type) {
				_.each(files, function(file) {
					if (type === 'mimeTypes') {
						fileTypes = mimeTypes.map(function(value) { return (/[^/]*$/.exec(value)[0]).toUpperCase(); }).join(', ');

						toastr.warning(file + self.i18n.active().portWizard.toastr.warning.mimeTypes.replace('{{variable}}', fileTypes));
					} else if (type === 'size') {
						toastr.warning(file + self.i18n.active().portWizard.toastr.warning.size.replace('{{variable}}', maxSize));
					}
				});
			});
		},

		portWizardHelperSavePort: function(args) {
			var self = this;

			self.portWizardUILoading(args, {
				title: self.i18n.active().portWizard.loading.title,
				text: self.i18n.active().portWizard.loading.text,
				callback: function() {
					if (args.data.request.hasOwnProperty('id')) {
						self.portWizardHelperUpdatePort(args);
					} else {
						self.portWizardHelperCreatePort(args);
					}
				}
			});
		},

		portWizardHelperCreatePort: function(args) {
			var self = this,
				attachments = _.extend({}, args.data.attachments);

			delete args.data.request.extra;

			self.portWizardRequestCreatePort({
				data: {
					accountId: args.data.accountId,
					data: args.data.request
				},
				success: function(port) {
					if (!_.isEmpty(attachments)) {
						_.each(attachments, function(attachment, key, object) {
							object[key] = function(callback) {
								self.portWizardRequestCreateAttachment({
									data: {
										accountId: args.data.accountId,
										portRequestId: port.id,
										documentName: key + '.pdf',
										data: attachment.file
									},
									success: function() {
										callback(null);
									}
								});
							};
						});

						monster.series(attachments, function(err, results) {
							if (err) {
								args.hasOwnProperty('error') && args.error();
							} else {
								args.hasOwnProperty('success') && args.success(port.id);
							}
						});
					} else {
						args.hasOwnProperty('success') && args.success(port.id);
					}
				},
				error: function() {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		portWizardHelperUpdatePort: function(args) {
			var self = this,
				attachments = _.extend({}, args.data.attachments);

			_.each(attachments, function(attachment, key, object) {
				if (!attachment.hasOwnProperty('name')) {
					delete object[key];
				}
			});

			delete args.data.request.extra;

			self.portWizardRequestUpdatePort({
				data: {
					accountId: args.data.accountId,
					data: args.data.request
				},
				success: function(port) {
					if (!_.isEmpty(attachments)) {
						_.each(attachments, function(attachment, key, object) {
							if (args.data.request.uploads.hasOwnProperty(key + '.pdf')) {
								object[key] = function(callback) {
									self.portWizardRequestUpdateAttachment({
										data: {
											accountId: args.data.accountId,
											portRequestId: port.id,
											documentName: key + '.pdf',
											data: attachment.file
										},
										success: function() {
											callback(null);
										}
									});
								};
							} else {
								object[key] = function(callback) {
									self.portWizardRequestCreateAttachment({
										data: {
											accountId: args.data.accountId,
											portRequestId: port.id,
											documentName: key + '.pdf',
											data: attachment.file
										},
										success: function() {
											callback(null);
										}
									});
								};
							}
						});

						monster.series(attachments, function(err, results) {
							if (err) {
								args.hasOwnProperty('error') && args.error();
							} else {
								args.hasOwnProperty('success') && args.success(port.id);
							}
						});
					} else {
						args.hasOwnProperty('success') && args.success(port.id);
					}
				},
				error: function() {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		portWizardHelperCancelPort: function(args) {
			var self = this;

			if (args.data.request.hasOwnProperty('id')) {
				self.portWizardRequestDeletePort({
					data: {
						accountId: args.data.accountId,
						portRequestId: args.data.request.id
					},
					success: function() {
						args.globalCallback();
					}
				});
			} else {
				args.globalCallback();
			}
		},

		/**************************************************
		 *              Requests declarations             *
		 **************************************************/

		// Port requests endpoints
		portWizardRequestCreatePort: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.create',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},
		portWizardRequestUpdatePort: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.update',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},
		portWizardRequestDeletePort: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.delete',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},
		portWizardRequestUpdateState: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.changeState',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		// Attachments endpoints
		portWizardRequestCreateAttachment: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.createAttachment',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},
		portWizardRequestGetAttahcment: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.getAttachment',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					// `data` is a string representation of the PDF in base 64
					args.hasOwnProperty('success') && args.success(data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},
		portWizardRequestUpdateAttachment: function(args) {
			var self = this;

			self.callApi({
				resource: 'port.updateAttachment',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		}
	};

	return portWizard;
});
