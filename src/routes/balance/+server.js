import nanogptjs from 'nanogptjs'

export async function POST({ request }) {
  let { apiKey } = await request.json()
  const nanogpt = nanogptjs({ apiKey })
  let balance = await nanogpt.balance()
  return new Response(balance)
}