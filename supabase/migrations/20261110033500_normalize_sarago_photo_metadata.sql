-- extracted_data conserva el nombre transcrito de la foto.
update public.taxi_tirilla_archive_images
set driver_name = 'Roberto Sarago'
where lower(btrim(driver_name)) = 'sarago';
