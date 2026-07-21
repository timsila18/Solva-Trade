import { ProductSetupForm } from "@/components/app/product-setup-form";

export default function NewProductPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Product setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create product or service</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Start simple with name, type, category and unit. Advanced distributor, batch, expiry, serial and reorder settings remain optional.
      </p>
      <ProductSetupForm />
    </div>
  );
}
