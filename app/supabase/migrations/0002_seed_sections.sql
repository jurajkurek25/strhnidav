-- Optional seed: the five pillars already announced on the landing page.
-- Safe to skip/edit — lessons can be assigned to these (or new) sections
-- from the admin panel.
insert into sections (title, description, order_index) values
  ('Priateľstvá', 'Ako pôsobiť tak, aby si si ľudí prirodzene získaval.', 1),
  ('Biznis partnerstvá', 'Dôvera a presvedčivosť tam, kde sa rozhoduje o peniazoch.', 2),
  ('Rodina', 'Vzťahy, ktoré si nevyberáš, ale môžeš ich zmeniť.', 3),
  ('Prezentácie', 'Ako strhnúť pozornosť miestnosti a udržať si ju.', 4),
  ('Randenie', 'Psychológia príťažlivosti bez naučených fráz.', 5)
on conflict do nothing;
