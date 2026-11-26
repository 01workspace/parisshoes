
with demo_products (
  slug, name, description, category, audience, price, colorway, badge,
  is_featured, sort_order, image_url, sizes
) as (
  values
  ('metro-knit-runner','Metro Knit Runner','A lightweight everyday runner with a breathable knit-inspired look and a cushioned step. Demo catalogue item; specifications and imagery can be replaced.','Running','men',2890,'Cloud / Silver','DEMO · FEATURED',true,1,'/resources/hero-shoe-2.png',array['40','41','42','43','44','45']),
  ('everyday-court','Everyday Court Low','A clean low-profile court sneaker for daily wear, easy styling and relaxed weekends. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','men',2490,'Chalk / Tomato','DEMO · BESTSELLER',true,2,'/resources/hero-shoe-1.png',array['40','41','42','43','44','45']),
  ('ridge-trail-01','Ridge Trail 01','A sturdy trail-inspired shoe with a confident profile for outdoor routes and changing ground. Demo catalogue item; specifications and imagery can be replaced.','Trail','men',3290,'Moss / Stone','DEMO',true,3,'/resources/hero-shoe-3.png',array['40','41','42','43','44','45']),
  ('atlas-court-low','Atlas Court Low','A versatile court silhouette with a quiet, streamlined shape and everyday comfort. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','men',2590,'Ink / Bone','DEMO · NEW',true,4,'/resources/hero-shoe-4.png',array['40','41','42','43','44','45']),
  ('weekend-loafer','Weekend Loafer','An easy slip-on loafer-inspired style for a smart-casual look. Demo catalogue item; specifications and imagery can be replaced.','Loafers','men',2790,'Stone / Brown','DEMO',false,5,'/resources/hero-shoe-2.png',array['40','41','42','43','44','45']),
  ('coast-sandal','Coast Everyday Sandal','A relaxed warm-weather sandal design for everyday outings. Demo catalogue item; specifications and imagery can be replaced.','Sandals','men',1890,'Tomato / Chalk','DEMO',false,6,'/resources/hero-shoe-5.png',array['40','41','42','43','44','45']),
  ('studio-runner','Studio Runner','A light, easy-running silhouette designed around comfort and a clean everyday finish. Demo catalogue item; specifications and imagery can be replaced.','Running','women',2790,'Cloud / Silver','DEMO · FEATURED',true,7,'/resources/hero-shoe-2.png',array['36','37','38','39','40','41']),
  ('cloud-court','Cloud Court Sneaker','A crisp court sneaker with a versatile profile for everyday outfits. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','women',2490,'Chalk / Tomato','DEMO · BESTSELLER',true,8,'/resources/hero-shoe-1.png',array['36','37','38','39','40','41']),
  ('daylight-flat','Daylight Flat','A simple, easy-to-style flat with a neat silhouette for workdays and weekends. Demo catalogue item; specifications and imagery can be replaced.','Flats','women',1990,'Ink / Bone','DEMO',false,9,'/resources/hero-shoe-4.png',array['36','37','38','39','40','41']),
  ('weekend-sandal','Weekend Strap Sandal','A casual strap sandal with a relaxed shape for warm days and easy plans. Demo catalogue item; specifications and imagery can be replaced.','Sandals','women',1790,'Tomato / Chalk','DEMO · NEW',true,10,'/resources/hero-shoe-5.png',array['36','37','38','39','40','41']),
  ('city-slip-on','City Slip-On','A no-fuss slip-on with a minimal look and a comfortable everyday fit. Demo catalogue item; specifications and imagery can be replaced.','Casual','women',2290,'Moss / Stone','DEMO',false,11,'/resources/hero-shoe-3.png',array['36','37','38','39','40','41']),
  ('rose-court','Rose Court Sneaker','A low-profile everyday sneaker with a soft, understated colour story. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','women',2590,'White / Grey','DEMO',false,12,'/resources/hero-shoe-2.png',array['36','37','38','39','40','41']),
  ('little-sprinter','Little Sprinter','A playful everyday sneaker concept for little feet, with an easy-to-wear shape. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','kids',1590,'Tomato / Chalk','DEMO · FEATURED',true,13,'/resources/hero-shoe-5.png',array['28','29','30','31','32','33','34']),
  ('school-day','School Day Shoe','A simple school-shoe concept with a classic profile for everyday routines. Demo catalogue item; specifications and imagery can be replaced.','School Shoes','kids',1490,'Ink / Bone','DEMO · BESTSELLER',true,14,'/resources/hero-shoe-4.png',array['28','29','30','31','32','33','34']),
  ('playground-runner','Playground Runner','A sporty sneaker concept for active days, playtime and everyday adventures. Demo catalogue item; specifications and imagery can be replaced.','Running','kids',1690,'Cloud / Silver','DEMO · NEW',true,15,'/resources/hero-shoe-2.png',array['28','29','30','31','32','33','34']),
  ('mini-sandal','Mini Day Sandal','A lightweight sandal concept for easy movement on warm days. Demo catalogue item; specifications and imagery can be replaced.','Sandals','kids',990,'Moss / Stone','DEMO',false,16,'/resources/hero-shoe-3.png',array['28','29','30','31','32','33','34']),
  ('tiny-court','Tiny Court Sneaker','A miniature court-inspired sneaker concept for everyday outfits and weekend plans. Demo catalogue item; specifications and imagery can be replaced.','Sneakers','kids',1590,'Chalk / Tomato','DEMO',false,17,'/resources/hero-shoe-1.png',array['28','29','30','31','32','33','34']),
  ('rainbow-step','Rainbow Step Slip-On','A cheerful slip-on shoe concept with an easy, low-profile shape. Demo catalogue item; specifications and imagery can be replaced.','Slip-ons','kids',1290,'White / Grey','DEMO',false,18,'/resources/hero-shoe-5.png',array['28','29','30','31','32','33','34'])
),
upserted as (
  insert into public.products (
    slug,name,description,category,audience,price,currency,colorway,badge,
    is_active,is_featured,sort_order
  )
  select slug,name,description,category,audience,price,'BDT',colorway,badge,true,is_featured,sort_order
  from demo_products
  on conflict (slug) do update set
    name=excluded.name,description=excluded.description,category=excluded.category,
    audience=excluded.audience,price=excluded.price,currency=excluded.currency,
    colorway=excluded.colorway,badge=excluded.badge,is_active=true,
    is_featured=excluded.is_featured,sort_order=excluded.sort_order
  returning id,slug
),
images as (
  insert into public.product_images (product_id,image_url,alt_text,"position")
  select p.id,d.image_url,d.name || ' demo product image',0
  from upserted p join demo_products d using (slug)
  on conflict (product_id,"position") do update
    set image_url=excluded.image_url,alt_text=excluded.alt_text
  returning product_id
)
insert into public.product_variants (product_id,size,sku,stock_quantity)
select p.id,s.size,upper(replace(p.slug,'-','')) || '-' || s.size,5
from upserted p
join demo_products d using (slug)
cross join lateral unnest(d.sizes) as s(size)
on conflict (product_id,size) do nothing;
