import { ProductSetupForm } from "@/components/app/product-setup-form";

function safeReturnTo(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] : value;
  return typeof resolved === "string" && resolved.startsWith("/") && !resolved.startsWith("//") ? resolved : undefined;
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Product setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create product or service</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Start simple with name, type, category and unit. Advanced distributor, batch, expiry, serial and reorder settings remain optional.
      </p>
      <ProductSetupForm returnTo={returnTo} />
    </div>
  );
}
