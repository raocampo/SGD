-- Migración 054: Agregar PayPal y pago con tarjeta (crédito/débito) a formas de pago

INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
VALUES
  ('pago_paypal_activo',        'false',                                                               'boolean', 'Habilitar pago con PayPal'),
  ('pago_paypal_enlace',        '',                                                                    'string',  'Enlace PayPal.me o correo PayPal para recibir pagos'),
  ('pago_paypal_instrucciones', 'Envía el pago como "Amigos y familiares" a la cuenta PayPal indicada y adjunta el comprobante por WhatsApp.', 'string', 'Instrucciones para pago con PayPal'),
  ('pago_tarjeta_activo',       'false',                                                               'boolean', 'Habilitar pago con tarjeta de crédito/débito'),
  ('pago_tarjeta_plataforma',   'Payphone',                                                            'string',  'Nombre de la plataforma de cobro con tarjeta (ej: Payphone, Stripe, PayPal)'),
  ('pago_tarjeta_enlace',       '',                                                                    'string',  'Enlace de pago con tarjeta (Payphone, Stripe u otro)'),
  ('pago_tarjeta_instrucciones','Haz clic en el botón para pagar de forma segura con tu tarjeta de crédito o débito.',  'string', 'Instrucciones para pago con tarjeta')
ON CONFLICT (clave) DO NOTHING;
