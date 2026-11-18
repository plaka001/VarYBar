insert into public.participantes (id, nombre, orden) values
  ('santiago',  'Santiago',  1),
  ('sebastian', 'Sebastián', 2),
  ('dani',      'Dani',      3),
  ('camilo',    'Camilo',    4);

-- Liga BetPlay 2026-II · cuadrangulares (local primero).
-- Fechas 1 y 2 con día, hora (Colombia) y estadio confirmados por la Dimayor; 3 a 6 sin programar todavía.
insert into public.partidos (id, fecha, grupo, local, visitante, inicio, estadio, orden) values
  ('c1-a1', 1, 'A', 'Medellín',    'Santa Fe',    '2026-11-20 16:30-05', 'Atanasio Girardot',      1),
  ('c1-b1', 1, 'B', 'Bucaramanga', 'América',     '2026-11-20 18:35-05', 'Américo Montanini',      2),
  ('c1-b2', 1, 'B', 'Cali',        'Millonarios', '2026-11-20 20:40-05', 'Estadio Deportivo Cali', 3),
  ('c1-a2', 1, 'A', 'Once Caldas', 'Nacional',    '2026-11-21 20:15-05', 'Palogrande',             4),

  ('c2-b1', 2, 'B', 'Millonarios', 'Bucaramanga', '2026-11-24 18:20-05', 'El Campín',              1),
  ('c2-b2', 2, 'B', 'América',     'Cali',        '2026-11-24 20:30-05', 'Pascual Guerrero',       2),
  ('c2-a1', 2, 'A', 'Santa Fe',    'Once Caldas', '2026-11-25 18:20-05', 'El Campín',              3),
  ('c2-a2', 2, 'A', 'Nacional',    'Medellín',    '2026-11-25 20:30-05', 'Atanasio Girardot',      4),

  ('c3-a1', 3, 'A', 'Santa Fe',    'Nacional',    null, null, 1),
  ('c3-a2', 3, 'A', 'Medellín',    'Once Caldas', null, null, 2),
  ('c3-b1', 3, 'B', 'Millonarios', 'América',     null, null, 3),
  ('c3-b2', 3, 'B', 'Cali',        'Bucaramanga', null, null, 4),

  ('c4-a1', 4, 'A', 'Nacional',    'Santa Fe',    null, null, 1),
  ('c4-a2', 4, 'A', 'Once Caldas', 'Medellín',    null, null, 2),
  ('c4-b1', 4, 'B', 'América',     'Millonarios', null, null, 3),
  ('c4-b2', 4, 'B', 'Bucaramanga', 'Cali',        null, null, 4),

  ('c5-a1', 5, 'A', 'Once Caldas', 'Santa Fe',    null, null, 1),
  ('c5-a2', 5, 'A', 'Medellín',    'Nacional',    null, null, 2),
  ('c5-b1', 5, 'B', 'Bucaramanga', 'Millonarios', null, null, 3),
  ('c5-b2', 5, 'B', 'Cali',        'América',     null, null, 4),

  ('c6-a1', 6, 'A', 'Santa Fe',    'Medellín',    null, null, 1),
  ('c6-a2', 6, 'A', 'Nacional',    'Once Caldas', null, null, 2),
  ('c6-b1', 6, 'B', 'Millonarios', 'Cali',        null, null, 3),
  ('c6-b2', 6, 'B', 'América',     'Bucaramanga', null, null, 4);
