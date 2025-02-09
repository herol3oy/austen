import { PageServerLoad } from "@analogjs/router";
import { ServerRequest } from "@analogjs/router/tokens";

import { createClient } from "../../server/supabase";

export async function load({ event }: PageServerLoad) {
  const client = createClient({ req: event.node.req as ServerRequest, res: event.node.res });

  const { data: countries } = await client.from('countries').select('name').limit(5);

  return { countries: countries ?? [] };
}
