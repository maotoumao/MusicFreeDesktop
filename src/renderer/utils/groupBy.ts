type IndexableType = number | string | symbol

export default function groupBy<T extends Record<IndexableType, any>, K extends keyof T> (values: T[], keyFinder: K | ((item: T) => K) )  {
    // if(Object.groupBy) {
    //     return Object.groupBy(values, keyFinder);
    // }
    // using reduce to aggregate values
    return values.reduce((a, b) => {
      // depending upon the type of keyFinder
      // if it is function, pass the value to it
      // if it is a property, access the property
      const key: K = typeof keyFinder === "function" ? keyFinder(b) : b[keyFinder];
      
      // aggregate values based on the keys
      if(!a[key]){
        a[key] = [b];
      }else{
        a[key] = [...a[key], b];
      }
      
      return a;
    }, {} as Record<K, T[]>);
  }