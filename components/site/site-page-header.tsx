// import SignIn from "@/components/site/sign-in";

type Props = {
  title: string;
  components?: React.ReactNode;
};

export default function SitePageHeader({ title, components }: Props) {
  return (
    <div className="site-page-header w-full flex flex-row items-start justify-between">
      <p className="text-xl font-mono font-medium tracking-wide">
        {title}
      </p>
      {components}
    </div>
  );
}