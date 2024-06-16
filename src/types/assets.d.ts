type Styles = Record<string, string>;

declare module "*.svg" {
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;

  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.ico" {
  const content: string;
  export default content;
}
