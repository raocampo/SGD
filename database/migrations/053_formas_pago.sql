-- Migración 053: Formas de pago configurables desde el panel admin
-- Permite al administrador definir los métodos de pago que se muestran
-- en la landing pública cuando el usuario selecciona un plan pagado.

INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
VALUES
  ('pago_whatsapp',              '593982413081',                              'string',  'Número WhatsApp para confirmar pagos (con código de país, sin +)'),
  ('pago_transferencia_banco',   'Banco Pichincha',                           'string',  'Nombre del banco para transferencias'),
  ('pago_transferencia_cuenta',  '',                                          'string',  'Número de cuenta bancaria'),
  ('pago_transferencia_tipo',    'Ahorro',                                    'string',  'Tipo de cuenta: Ahorro o Corriente'),
  ('pago_transferencia_titular', 'Loja Torneos & Competencias',               'string',  'Titular de la cuenta bancaria'),
  ('pago_transferencia_cedula',  '',                                          'string',  'Cédula/RUC del titular de la cuenta'),
  ('pago_efectivo_activo',       'false',                                     'boolean', 'Habilitar pago en efectivo'),
  ('pago_efectivo_instrucciones','Coordina la entrega de efectivo por WhatsApp.','string','Instrucciones para pago en efectivo'),
  ('pago_instrucciones_extra',   'Envía el comprobante de pago al WhatsApp indicado para activar tu cuenta.','string','Instrucciones generales al finalizar el pago')
ON CONFLICT (clave) DO NOTHING;
