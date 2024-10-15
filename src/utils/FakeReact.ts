// Taken from https://dev.to/jaredkent/faking-react-for-vscode-webviews-2258

export function createElement(
  type: string,
  attributes = {},
  ...children: JSX.Element[]
) {
  if (attributes === null) {
    attributes = {};
  }
  const attributeString = Object.entries(attributes)
    .map(([attr, value]) => `${attr}="${value}"`)
    .join(" ");
  const childrenString = Array.isArray(children)
    ? children.filter((c) => c !== null).join("")
    : children || "";
  return `<${type} ${attributeString}>${childrenString}</${type}>`;
}

export function Fragment(props: any) {
  return props.children;
}

export default {
  createElement,
  Fragment,
};
