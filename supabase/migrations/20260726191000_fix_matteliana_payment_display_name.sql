update public.businesses
set payment_details = payment_details || jsonb_build_object(
  'payment_display_name', 'Matteliana Fish Supply'
)
where lower(coalesce(trading_name, legal_name, '')) like '%matteliana%fish%supply%'
  and payment_details->>'payment_display_name' = 'Matteliaba Fish Supply';

