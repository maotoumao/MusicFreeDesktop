export default function camelToSnake(camelCaseStr: string): string {
  return camelCaseStr.replace(/([A-Z])/g, "_$1").toLowerCase(); // 将整个字符串转换为小写
}
