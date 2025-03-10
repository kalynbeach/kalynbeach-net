import SiteBreadcrumb from "./site-breadcrumb";

type Props = {
  title: string;
  components?: React.ReactNode;
};

export default function SitePageHeader({ title, components }: Props) {
  return (
    <div className="site-page-header w-full h-20 md:h-24 flex flex-row items-center justify-between gap-4">
      {/* <h1 className="text-2xl md:text-3xl font-mono font-semibold uppercase">
        {title}
      </h1> */}
      <SiteBreadcrumb />
      {components}
    </div>
  );
}