type Props = {
  title: string;
  components?: React.ReactNode;
};

export default function SitePageHeader({ title, components }: Props) {
  return (
    <div className="site-page-header w-full flex flex-row items-start justify-between">
      <h1 className="text-2xl md:text-3xl font-mono font-bold dark:font-normal uppercase">
        {title}
      </h1>
      {components}
    </div>
  );
}