-- =====================================================================
-- DATOS DE EJEMPLO
-- Categorías, ~50 productos, zonas de envío y franjas horarias para probar.
-- Se puede correr más de una vez sin duplicar nada.
-- Marcas y códigos de barras son inventados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuración del comercio (editable después desde el panel)
-- ---------------------------------------------------------------------
update public.settings set
  store_name          = 'Súper del Barrio',
  store_address       = 'Av. Siempreviva 742, Buenos Aires',
  whatsapp_phone      = '5491100000000',
  opening_hours       = 'Lunes a sábado de 8 a 21 h · Domingos de 9 a 13 h',
  bank_alias          = 'SUPER.BARRIO.MP',
  bank_cbu            = '0000000000000000000000',
  bank_holder         = 'Súper del Barrio S.A.',
  min_order_amount    = 5000,
  shipping_mode       = 'zones',
  shipping_fixed_cost = 1500,
  free_shipping_from  = 40000
where id = 1;

-- ---------------------------------------------------------------------
-- Zonas de envío y franjas horarias (solo si todavía no hay ninguna)
-- ---------------------------------------------------------------------
insert into public.delivery_zones (name, cost, sort_order)
select * from (values
  ('Hasta 10 cuadras del local', 1000, 1),
  ('Resto del barrio',           1800, 2),
  ('Barrios vecinos',            2800, 3)
) as v(name, cost, sort_order)
where not exists (select 1 from public.delivery_zones);

insert into public.time_slots (delivery_mode, weekdays, start_time, end_time, sort_order)
select * from (values
  (null::public.delivery_mode,  '{1,2,3,4,5,6}'::smallint[], '09:00'::time, '12:00'::time, 1),
  (null::public.delivery_mode,  '{1,2,3,4,5,6}'::smallint[], '12:00'::time, '16:00'::time, 2),
  (null::public.delivery_mode,  '{1,2,3,4,5,6}'::smallint[], '16:00'::time, '20:00'::time, 3),
  ('pickup'::public.delivery_mode, '{0}'::smallint[],        '09:00'::time, '13:00'::time, 4)
) as v(delivery_mode, weekdays, start_time, end_time, sort_order)
where not exists (select 1 from public.time_slots);

-- ---------------------------------------------------------------------
-- Categorías (nivel 1)
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Almacén',     'almacen',     1),
  ('Bebidas',     'bebidas',     2),
  ('Lácteos',     'lacteos',     3),
  ('Frescos',     'frescos',     4),
  ('Congelados',  'congelados',  5),
  ('Limpieza',    'limpieza',    6),
  ('Perfumería',  'perfumeria',  7),
  ('Mascotas',    'mascotas',    8)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Subcategorías (nivel 2)
-- ---------------------------------------------------------------------
insert into public.categories (parent_id, name, slug, sort_order)
select p.id, v.name, v.slug, v.sort_order
from (values
  ('almacen',    'Yerba, café y té',          'yerba-cafe-y-te',        1),
  ('almacen',    'Fideos, arroz y harinas',   'fideos-arroz-y-harinas', 2),
  ('almacen',    'Aceites y aderezos',        'aceites-y-aderezos',     3),
  ('almacen',    'Galletitas y golosinas',    'galletitas-y-golosinas', 4),
  ('almacen',    'Conservas',                 'conservas',              5),
  ('bebidas',    'Gaseosas',                  'gaseosas',               1),
  ('bebidas',    'Aguas y jugos',             'aguas-y-jugos',          2),
  ('bebidas',    'Cervezas y vinos',          'cervezas-y-vinos',       3),
  ('lacteos',    'Leches',                    'leches',                 1),
  ('lacteos',    'Yogures y postres',         'yogures-y-postres',      2),
  ('lacteos',    'Quesos y manteca',          'quesos-y-manteca',       3),
  ('frescos',    'Frutas y verduras',         'frutas-y-verduras',      1),
  ('frescos',    'Carnes y pollo',            'carnes-y-pollo',         2),
  ('frescos',    'Fiambres',                  'fiambres',               3),
  ('frescos',    'Panadería',                 'panaderia',              4),
  ('congelados', 'Comidas congeladas',        'comidas-congeladas',     1),
  ('congelados', 'Helados',                   'helados',                2),
  ('limpieza',   'Cuidado de la ropa',        'cuidado-de-la-ropa',     1),
  ('limpieza',   'Cocina y baño',             'cocina-y-bano',          2),
  ('limpieza',   'Papeles',                   'papeles',                3),
  ('perfumeria', 'Cuidado personal',          'cuidado-personal',       1),
  ('perfumeria', 'Cabello',                   'cabello',                2),
  ('perfumeria', 'Bebés',                     'bebes',                  3),
  ('mascotas',   'Perros',                    'perros',                 1),
  ('mascotas',   'Gatos',                     'gatos',                  2)
) as v(parent_slug, name, slug, sort_order)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Productos
-- Incluye a propósito: ofertas (con precio anterior), productos por kilo
-- (se suman de a 0,25 o 0,5), packs, productos con precio en cero
-- (todavía sin cargar) y uno sin stock. Ninguno tiene imagen: se ve el placeholder.
-- ---------------------------------------------------------------------
insert into public.products
  (sku, barcode, name, brand, category_id, price, previous_price, on_sale,
   sale_unit, quantity_step, net_content, net_content_unit, stock, description)
select v.sku, v.barcode, v.name, v.brand, c.id, v.price, v.previous_price, v.on_sale,
       v.sale_unit::public.sale_unit, v.quantity_step, v.net_content,
       v.net_content_unit::public.content_unit, v.stock, v.description
from (values
  -- Almacén · Yerba, café y té
  ('A0001','7790000000011','Yerba mate suave','Don Mateo','yerba-cafe-y-te',2400,3000,true,'unidad',1,500,'g',40,'Yerba mate con palo, sabor suave. Ideal para todos los días.'),
  ('A0002','7790000000028','Yerba mate tradicional','Don Mateo','yerba-cafe-y-te',4900,null,false,'unidad',1,1,'kg',35,'Yerba mate con palo, estacionada 12 meses.'),
  ('A0003','7790000000035','Café molido torrado','Cafetal','yerba-cafe-y-te',3800,null,false,'unidad',1,250,'g',22,'Café torrado molido intenso.'),
  ('A0004','7790000000042','Té en saquitos x 50','Hoja Verde','yerba-cafe-y-te',1500,null,false,'unidad',1,100,'g',50,'Té negro clásico, caja de 50 saquitos.'),
  ('A0005','7790000000059','Azúcar común','Dulzura','yerba-cafe-y-te',1100,null,false,'unidad',1,1,'kg',80,'Azúcar blanca común tipo A.'),
  -- Almacén · Fideos, arroz y harinas
  ('A0006','7790000000066','Fideos spaghetti','La Nonna','fideos-arroz-y-harinas',1200,null,false,'unidad',1,500,'g',60,'Fideos secos de sémola.'),
  ('A0007','7790000000073','Fideos tirabuzón','La Nonna','fideos-arroz-y-harinas',1200,1450,true,'unidad',1,500,'g',55,'Fideos secos de sémola, ideales para ensaladas y salsas.'),
  ('A0008','7790000000080','Arroz largo fino','Granero','fideos-arroz-y-harinas',1650,null,false,'unidad',1,1,'kg',70,'Arroz blanco largo fino, no se pasa.'),
  ('A0009','7790000000097','Harina de trigo 000','Molino Viejo','fideos-arroz-y-harinas',850,null,false,'unidad',1,1,'kg',90,'Harina de trigo triple cero.'),
  ('A0010','7790000000103','Polenta instantánea','Granero','fideos-arroz-y-harinas',0,null,false,'unidad',1,500,'g',30,'Harina de maíz de cocción rápida, lista en un minuto.'),
  -- Almacén · Aceites y aderezos
  ('A0011','7790000000110','Aceite de girasol','Sol Dorado','aceites-y-aderezos',2900,null,false,'unidad',1,1.5,'l',45,'Aceite puro de girasol.'),
  ('A0012','7790000000127','Aceite de oliva extra virgen','Olivar del Sur','aceites-y-aderezos',7800,9200,true,'unidad',1,500,'ml',18,'Aceite de oliva extra virgen, primera prensada en frío.'),
  ('A0013','7790000000134','Mayonesa clásica','Sabrosa','aceites-y-aderezos',1750,null,false,'unidad',1,475,'g',40,'Mayonesa clásica en doypack.'),
  ('A0014','7790000000141','Sal fina','Salina','aceites-y-aderezos',650,null,false,'unidad',1,500,'g',100,'Sal fina de mesa.'),
  -- Almacén · Galletitas y golosinas
  ('A0015','7790000000158','Galletitas de agua','Crocantes','galletitas-y-golosinas',900,null,false,'unidad',1,300,'g',65,'Galletitas crackers clásicas, pack triple.'),
  ('A0016','7790000000165','Galletitas dulces de vainilla','Crocantes','galletitas-y-golosinas',1100,null,false,'unidad',1,250,'g',48,'Galletitas dulces sabor vainilla.'),
  ('A0017','7790000000172','Alfajor de chocolate','Tentación','galletitas-y-golosinas',700,null,false,'unidad',1,50,'g',120,'Alfajor triple bañado en chocolate, relleno de dulce de leche.'),
  ('A0018','7790000000189','Dulce de leche clásico','La Estancia','galletitas-y-golosinas',2300,2700,true,'unidad',1,400,'g',36,'Dulce de leche clásico, estilo familiar.'),
  -- Almacén · Conservas
  ('A0019','7790000000196','Puré de tomate','Huerta Roja','conservas',780,null,false,'unidad',1,520,'g',85,'Puré de tomate en tetrabrik.'),
  ('A0020','7790000000202','Atún al natural','Mar Azul','conservas',2100,null,false,'unidad',1,170,'g',42,'Lomitos de atún al natural.'),
  ('A0021','7790000000219','Arvejas en lata','Huerta Roja','conservas',690,null,false,'unidad',1,300,'g',58,'Arvejas secas remojadas.'),
  -- Bebidas
  ('B0001','7790000000226','Gaseosa cola','Burbuja','gaseosas',2500,null,false,'unidad',1,2.25,'l',60,'Gaseosa sabor cola.'),
  ('B0002','7790000000233','Gaseosa lima limón','Burbuja','gaseosas',2300,2800,true,'unidad',1,2.25,'l',44,'Gaseosa sabor lima limón.'),
  ('B0003','7790000000240','Agua mineral sin gas','Manantial','aguas-y-jugos',900,null,false,'unidad',1,2,'l',90,'Agua mineral natural de baja mineralización.'),
  ('B0004','7790000000257','Agua mineral sin gas pack x 6','Manantial','aguas-y-jugos',4800,null,false,'pack',1,12,'l',25,'Pack de 6 botellas de 2 litros.'),
  ('B0005','7790000000264','Jugo de naranja','Frutal','aguas-y-jugos',1900,null,false,'unidad',1,1,'l',33,'Jugo de naranja listo para tomar.'),
  ('B0006','7790000000271','Cerveza rubia lata','Cebada Real','cervezas-y-vinos',1300,null,false,'unidad',1,473,'ml',96,'Cerveza rubia tipo lager.'),
  ('B0007','7790000000288','Vino tinto malbec','Viña Andina','cervezas-y-vinos',4500,5600,true,'unidad',1,750,'ml',28,'Vino tinto malbec de Mendoza.'),
  -- Lácteos
  ('L0001','7790000000295','Leche entera larga vida','La Vaquita','leches',1350,null,false,'unidad',1,1,'l',120,'Leche entera ultrapasteurizada.'),
  ('L0002','7790000000301','Leche descremada larga vida','La Vaquita','leches',1350,null,false,'unidad',1,1,'l',95,'Leche descremada ultrapasteurizada.'),
  ('L0003','7790000000318','Yogur bebible de frutilla','La Vaquita','yogures-y-postres',1800,null,false,'unidad',1,900,'g',30,'Yogur bebible entero sabor frutilla.'),
  ('L0004','7790000000325','Postre de chocolate','Dulce Hogar','yogures-y-postres',0,null,false,'unidad',1,120,'g',24,'Postrecito de chocolate.'),
  ('L0005','7790000000332','Queso cremoso','La Estancia','quesos-y-manteca',8900,null,false,'kilo',0.25,null,null,15,'Queso cremoso fraccionado. Pedí de a 250 g.'),
  ('L0006','7790000000349','Queso rallado','La Estancia','quesos-y-manteca',1600,null,false,'unidad',1,120,'g',52,'Queso rallado en sobre.'),
  ('L0007','7790000000356','Manteca','La Vaquita','quesos-y-manteca',2600,3100,true,'unidad',1,200,'g',38,'Manteca de primera calidad.'),
  -- Frescos
  ('F0001',null,'Banana',null,'frutas-y-verduras',1800,null,false,'kilo',0.5,null,null,60,'Banana fresca. Pedí de a medio kilo.'),
  ('F0002',null,'Tomate redondo',null,'frutas-y-verduras',2200,null,false,'kilo',0.5,null,null,45,'Tomate redondo fresco.'),
  ('F0003',null,'Papa',null,'frutas-y-verduras',900,1200,true,'kilo',0.5,null,null,150,'Papa negra lavada.'),
  ('F0004',null,'Lechuga criolla',null,'frutas-y-verduras',1100,null,false,'unidad',1,null,null,20,'Planta de lechuga criolla.'),
  ('F0005','7790000000363','Pechuga de pollo',null,'carnes-y-pollo',6900,null,false,'kilo',0.5,null,null,25,'Pechuga de pollo fresca, sin hueso.'),
  ('F0006','7790000000370','Carne picada especial',null,'carnes-y-pollo',8500,null,false,'kilo',0.5,null,null,0,'Carne picada especial, magra.'),
  ('F0007','7790000000387','Jamón cocido feteado','Del Campo','fiambres',2900,null,false,'unidad',1,200,'g',26,'Jamón cocido natural, feteado.'),
  ('F0008','7790000000394','Pan lactal blanco','Horno Casero','panaderia',2400,null,false,'unidad',1,550,'g',34,'Pan de molde blanco.'),
  -- Congelados
  ('C0001','7790000000400','Hamburguesas de carne x 4','Parrillera','comidas-congeladas',3900,4600,true,'unidad',1,320,'g',32,'Hamburguesas de carne vacuna congeladas.'),
  ('C0002','7790000000417','Helado de dulce de leche','Polo Sur','helados',6500,null,false,'unidad',1,1,'kg',14,'Helado de dulce de leche en pote.'),
  -- Limpieza
  ('M0001','7790000000424','Jabón líquido para ropa','Blancura','cuidado-de-la-ropa',7200,null,false,'unidad',1,3,'l',27,'Jabón líquido para lavarropas, baja espuma.'),
  ('M0002','7790000000431','Lavandina','Blancura','cocina-y-bano',1100,null,false,'unidad',1,2,'l',64,'Lavandina concentrada.'),
  ('M0003','7790000000448','Detergente para vajilla','Brillo','cocina-y-bano',1500,1900,true,'unidad',1,750,'ml',53,'Detergente concentrado aroma limón.'),
  ('M0004','7790000000455','Papel higiénico x 4','Suavecito','papeles',2800,null,false,'pack',1,null,null,70,'Papel higiénico doble hoja, 4 rollos de 30 m.'),
  ('M0005','7790000000462','Rollo de cocina x 3','Suavecito','papeles',2600,null,false,'pack',1,null,null,48,'Rollos de cocina, 3 unidades.'),
  -- Perfumería
  ('P0001','7790000000479','Jabón de tocador x 3','Fresca','cuidado-personal',1900,null,false,'pack',1,375,'g',56,'Jabón de tocador hidratante, pack x 3.'),
  ('P0002','7790000000486','Pasta dental','Sonrisa','cuidado-personal',1700,null,false,'unidad',1,90,'g',62,'Pasta dental con flúor.'),
  ('P0003','7790000000493','Shampoo','Seda Natural','cabello',3400,null,false,'unidad',1,400,'ml',31,'Shampoo para todo tipo de cabello.'),
  ('P0004','7790000000509','Pañales talle M x 36','Bebitos','bebes',0,null,false,'pack',1,null,null,19,'Pañales descartables talle M.'),
  -- Mascotas
  ('X0001','7790000000516','Alimento para perros adultos','Colita Feliz','perros',14500,17000,true,'unidad',1,8,'kg',12,'Alimento balanceado para perros adultos, carne y cereales.'),
  ('X0002','7790000000523','Alimento para gatos adultos','Colita Feliz','gatos',9800,null,false,'unidad',1,3,'kg',16,'Alimento balanceado para gatos adultos, sabor pescado.')
) as v(sku, barcode, name, brand, cat_slug, price, previous_price, on_sale,
       sale_unit, quantity_step, net_content, net_content_unit, stock, description)
join public.categories c on c.slug = v.cat_slug
on conflict (sku) do nothing;
