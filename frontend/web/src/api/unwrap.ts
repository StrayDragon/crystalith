type ApiFieldsResponse<TData> = {
  data: TData;
};

export async function unwrapData<TData>(request: Promise<ApiFieldsResponse<TData>>): Promise<TData> {
  const { data } = await request;
  return data;
}
