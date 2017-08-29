export async function sequence(array, promiseGenerator) {
  const results = [];
  for (const item of array) {
    results.push(await promiseGenerator(item));
  }

  return results;
}
